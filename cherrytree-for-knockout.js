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
      console.log('routeComponent at depth ' + depth + ' updating to ' + route.name)

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
    console.log('transition: ' + transition.routes.map(function(r) { return r.name }).join(', '))
    console.log('query: ' + JSON.stringify(transition.query))

    activeRoutes([])
    return transition.routes.filter(function(route) {
      return route.options && route.options.template
    }).map(function(route) {
      return function(parentRoute) {
        var routeData = {
          name: ko.bindingHandlers.routeComponent.prefix + route.ancestors.concat([route.name]).join('.'),
          params: transition.params,
          query: transition.query,
          resolutions: parentRoute && parentRoute.resolutions
        }
        if (!ko.components.isRegistered(routeData.name)) {
          ko.components.register(routeData.name, route.options)
        }

        console.log('resolving route ' + routeData.name)
        if (route.options.resolve) {
          var resolvers = Object.keys(route.options.resolve)

          routeData.resolutions = ko.observable()
          activeRoutes.push(routeData)
          console.log('routes after push: ' + activeRoutes.peek().map(function(r) { return r.name }).join(', '))

          return Promise.all(resolvers.map(function(resolver) {
            return route.options.resolve[resolver](transition, ko.utils.unwrapObservable(parentRoute && parentRoute.resolutions))
          })).then(function(resolutions) {
            routeData.resolutions(resolutions.reduce(function(all, r, idx) {
              all[resolvers[idx]] = r
              return all
            }, ko.utils.unwrapObservable(parentRoute && parentRoute.resolutions) || {}))
            return routeData
          })
        } else {
          activeRoutes.push(routeData)
          return routeData
        }
      }
    }).reduce(function(promise, then) {
      if (!promise) {
        var val = then()
        return typeof val.then === 'function' ? val : Promise.resolve(val)
      }
      return promise.then(then)
    }, null)
  }
})