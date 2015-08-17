(function(factory) {
  if (typeof define === 'function' && define.amd) {
    define(['knockout'], factory)
  } else if (typeof exports === 'object' && typeof module === 'object') {
    /*global module*/
    module.exports = factory
  } else {
    /*global ko*/
    var middleware = factory(ko)
    ko.bindingHandlers.routeComponent.middleware = middleware
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

  ko.bindingHandlers.routeComponent = {
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

      return ko.bindingHandlers.component.init(element, function() {
        var res = route.resolutions()
        if (res) {
          var clone = {}
          Object.keys(res).forEach(function(key) {
            clone[key] = res[key]
          })
          clone.$route = {
            name: route.name,
            query: route.query,
            params: route.params
          }
          return { name: route.name, params: clone }
        } else {
          return { name: 'route-loading' }
        }
      }, allBindings, viewModel, bindingContext)
    }
  }
  ko.bindingHandlers.routeComponent.prefix = 'route:'

  return function knockoutCherrytreeMiddleware(transition) {
    var resolutions = {}, routeResolvers = []
    activeRoutes(transition.routes.map(function(route) {
      var routeData
      if (route.options && route.options.template) {
        routeData = {
          name: ko.bindingHandlers.routeComponent.prefix + route.ancestors.concat([route.name]).join('.'),
          params: transition.params,
          query: transition.query,
          resolutions: ko.observable()
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