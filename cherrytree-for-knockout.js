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
    viewModel: { instance: {} },
    template: '<div></div>'
  })

  ko.components.register('route-loading', {
    viewModel: { instance: {} },
    template: '<div class="route-loading"></div>'
  })

  ko.bindingHandlers.routeView = {
    init: function() {
      return { controlsDescendantBindings: true }
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      var depth = 0, contextIter = bindingContext.$parentContext
      while (contextIter) {
        if ('$route' in contextIter) {
          depth++
        }
        contextIter = contextIter.$parentContext
      }

      var route = activeRoutes()[depth] || { name: 'route-blank', resolutions: function(){ return {} } }
      bindingContext.$route = route

      var router = valueAccessor()
      if (router && typeof router.map === 'function' && typeof router.use === 'function') {
        if (!bindingContext.$root.$router) {
          bindingContext.$root.$router = router

          if (!Object.getOwnPropertyDescriptor(router, 'state').get) {
            var routeState = ko.observable(router.state)
            ;delete router.state
            Object.defineProperty(router, 'state', {
              get: routeState,
              set: routeState,
              enumerable: true
            })
          }
        }
      }

      function clone(obj) {
        return Object.keys(obj).reduce(function(clone, key) {
          clone[key] = obj[key]
          return clone
        }, {})
      }

      return ko.bindingHandlers.component.init(element, function() {
        var res = route.resolutions()
        if (res) {
          var params = clone(res)
          params.$route = clone(route)
          delete params.$route.resolutions
          return { name: route.name, params: params }
        } else {
          return { name: 'route-loading' }
        }
      }, allBindings, viewModel, bindingContext)
    }
  }
  ko.bindingHandlers.routeView.prefix = 'route:'

  ko.bindingHandlers.routeHref = {
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      var router = bindingContext.$root.$router
      if (!router) {
        throw new Error('No router found on the root binding context. Make sure to initialize the toplevel routeView with your router as the option.')
      }

      return ko.bindingHandlers.attr.update(element, function() {
        var opts = ko.utils.unwrapObservable(valueAccessor()) || {}, name, params
        if (typeof opts === 'string') {
          name = opts
        } else {
          name = ko.utils.unwrapObservable(opts.name)
          params = ko.utils.unwrapObservable(opts.params)
        }

        return {
          href: router.generate(
            name || router.state.routes[router.state.routes.length - 1].name,
            params || router.state.params)
        }
      }, allBindings, viewModel, bindingContext)
    }
  }

  return function knockoutCherrytreeMiddleware(transition) {
    var resolutions = {}, routeResolvers = []
    activeRoutes(transition.routes.map(function(route) {
      var routeData
      if (route.options && route.options.template) {
        routeData = {
          name: ko.bindingHandlers.routeView.prefix + route.ancestors.concat([route.name]).join('.'),
          params: transition.params,
          query: transition.query,
          resolutions: ko.observable(),
          transitionTo: transition.redirectTo
        }
        if (!ko.components.isRegistered(routeData.name)) {
          ko.components.register(routeData.name, route.options)
        }
      }

      var resolve = route.options && route.options.resolve
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
    }).filter(function(i) { return !!i }))

    return routeResolvers.reduce(function(promise, then) {
      return promise ? promise.then(then) : then()
    }, null)
  }
})