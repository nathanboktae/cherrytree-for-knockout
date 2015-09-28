(function(factory) {
  if (typeof define === 'function' && define.amd) {
    define(['knockout'], factory)
  } else if (typeof exports === 'object' && typeof module === 'object') {
    /*global module*/
    module.exports = factory
  } else {
    /*global ko*/
    var middleware = factory(ko)
    ko.bindingHandlers.routeView.middleware = middleware
  }
})(function(ko) {
  var activeRoutes = ko.observableArray()

  ko.components.register('route-blank', {
    template: '<div></div>',
    synchronous: true
  })

  ko.components.register('route-loading', {
    template: '<div class="route-loading"></div>',
    synchronous: true
  })

  function clone(obj) {
    return Object.keys(obj).reduce(function(clone, key) {
      clone[key] = obj[key]
      return clone
    }, {})
  }

  ko.bindingHandlers.routeView = {
    init: function(_, valueAccessor, __, ___, bindingContext) {
      var router = valueAccessor()
      if (router && typeof router.map === 'function' && typeof router.use === 'function') {
        if (!bindingContext.$root.router) {
          bindingContext.$root.router = router
        }
      }

      return { controlsDescendantBindings: true }
    },
    update: function(element, valueAccessor, ab, vm, bindingContext) {
      var depth = 0, contextIter = bindingContext.$parentContext,
      routeComponent = ko.observable({ name: 'route-blank' }),
      prevRoute

      while (contextIter) {
        if ('$route' in contextIter) {
          depth++
        }
        contextIter = contextIter.$parentContext
      }

      ko.computed(function() {
        var route = activeRoutes()[depth]
        if (route == prevRoute) return
        if (!route) {
          routeComponent({ name: 'route-blank' })
          return
        }

        bindingContext.$route = route

        var res = route.resolutions()
        if (res) {
          var params = clone(res)
          params.$route = clone(route)
          delete params.$route.resolutions
          prevRoute = route
          routeComponent({ name: route.name, params: params })
        } else {
          routeComponent({ name: 'route-loading' })
        }
      }, null, { disposeWhenNodeIsRemoved: element }).extend({ rateLimit: 5 })

      return ko.bindingHandlers.component.init(element, routeComponent, ab, vm, bindingContext)
    }
  }
  ko.bindingHandlers.routeView.prefix = 'route:'

  ko.bindingHandlers.routeHref = {
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      var router = bindingContext.$root.router
      if (!router) {
        throw new Error('No router found on the root binding context. Make sure to initialize the toplevel routeView with your router as the option.')
      }

      return ko.bindingHandlers.attr.update(element, function() {
        var opts = ko.unwrap(valueAccessor()), name, params
        if (typeof opts === 'string') {
          name = opts
        } else {
          name = ko.unwrap(opts.name)
          params = ko.unwrap(opts.params)
        }

        return {
          href: router.generate(
            name || bindingContext.$route.name.substr(ko.bindingHandlers.routeView.prefix.length),
            params || bindingContext.$route.params)
        }
      }, allBindings, viewModel, bindingContext)
    }
  }

  function routeEqual(comp, route) {
    if (!comp || !route || comp.name.substr(ko.bindingHandlers.routeView.prefix.length) !== route.name) return false

    return Object.keys(route.params).every(function(param) {
      return comp.params[param] === route.params[param]
    })
  }

  return function knockoutCherrytreeMiddleware(transition) {
    var resolutions = {}, routeResolvers = [], startIdx = 0,
    filteredRoutes = transition.routes.filter(function(route) {
      return route.options && !!(route.options.template || route.options.resolve)
    })


    while (routeEqual(activeRoutes()[startIdx], filteredRoutes[startIdx]))
      startIdx++

    var newRoutes = filteredRoutes.slice(startIdx).map(function(route) {
      var routeData
      if (route.options.template) {
        routeData = {
          name: ko.bindingHandlers.routeView.prefix + route.name,
          params: transition.params,
          query: transition.query,
          resolutions: ko.observable(),
          transitionTo: transition.redirectTo
        }
        if (!ko.components.isRegistered(routeData.name)) {
          ko.components.register(routeData.name, route.options)
        }
      }

      var resolve = route.options.resolve
      if (resolve || routeResolvers.length) {
        var resolvers = Object.keys(resolve || {})

        routeResolvers.push(function() {
          return Promise.all(resolvers.map(function(resolver) {
            return route.options.resolve[resolver](transition, resolutions)
          })).then(function(moreResolutions) {
            moreResolutions.reduce(function(all, r, idx) {
              all[resolvers[idx]] = r
              return all
            }, resolutions)
            routeData && routeData.resolutions(resolutions)
            return routeData
          })
        })
      } else if (routeData) {
        routeData.resolutions(resolutions)
      }
      return routeData
    }).filter(function(i) { return !!i })

    activeRoutes.splice.apply(activeRoutes, [startIdx, activeRoutes().length - startIdx].concat(newRoutes))

    return routeResolvers.reduce(function(promise, then) {
      return promise ? promise.then(then) : then()
    }, null)
  }
})