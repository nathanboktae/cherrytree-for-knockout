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

      var route = activeRoutes()[depth] || { name: 'route-blank' }

      bindingContext.$route = route

      return ko.bindingHandlers.component.init(element, function() {
        if (route.resolutions) {
          return route.resolutions() ?
            { name: route.name, params: route.resolutions() } :
            { name: 'route-loading' }
        } else {
          return { name: route.name }
        }
      }, allBindings, viewModel, bindingContext)
    }
  }
  ko.bindingHandlers.routeComponent.prefix = 'route:'

  return function knockoutCherrytreeMiddleware(transition) {
    var resolutions = {}, routeResolvers = []
    activeRoutes(transition.routes.filter(function(route) {
      return route.options && route.options.template
    }).map(function(route) {
      var routeData = {
        name: ko.bindingHandlers.routeComponent.prefix + route.ancestors.concat([route.name]).join('.'),
        params: transition.params,
        query: transition.query,
        resolutions: route.options.resolve && ko.observable()
      }
      if (!ko.components.isRegistered(routeData.name)) {
        ko.components.register(routeData.name, route.options)
      }

      if (route.options.resolve) {
        var resolvers = Object.keys(route.options.resolve)

        routeResolvers.push(function() {
          return Promise.all(resolvers.map(function(resolver) {
            return route.options.resolve[resolver](transition, resolutions)
          })).then(function(moreResolutions) {
            routeData.resolutions(moreResolutions.reduce(function(all, r, idx) {
              all[resolvers[idx]] = r
              return all
            }, resolutions))
            return routeData
          })
        })
      }
      return routeData
    }))

    return routeResolvers.reduce(function(promise, then) {
      return promise ? promise.then(then) : then()
    }, null)
  }
})