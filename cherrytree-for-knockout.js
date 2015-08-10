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
        return { name: route.name }
      }, allBindings, viewModel, bindingContext)
    }
  }
  ko.bindingHandlers.routeComponent.prefix = 'route:'

  return function knockoutCherrytreeMiddleware(transition) {
    activeRoutes(transition.routes.filter(function(route) {
      return route.options && route.options.template
    }).map(function(route) {
      var compName = ko.bindingHandlers.routeComponent.prefix + route.ancestors.concat([route.name]).join('.')
      if (!ko.components.isRegistered(compName)) {
        ko.components.register(compName, route.options)
      }
      return {
        name: compName,
        params: transition.params,
        query: transition.query
      }
    }))
    // return Promise.all(compNamesOrPromises.filter(function(i) { return typeof i !== 'string' }))
  }
})