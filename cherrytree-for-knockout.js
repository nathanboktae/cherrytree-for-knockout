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
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      var depth = 0
      for (var i = 0; i < bindingContext.$parents.length; i++) {
        if ('$route' in bindingContext.$parents[i]) {
          depth++
        }
      }

      if (depth >= activeRoutes().length) {
        //console.log('The depth of route bindings (' + depth + ') exceeds current route length of ' + activeRoutes().length)
        //console.dir(activeRoutes())
      }
      ko.utils.domData.set(element, 'route-depth', depth)
      return ko.bindingHandlers.component.init(element, function() {
        return { name: typeof activeRoutes()[depth] === 'string' ? activeRoutes()[depth] : 'route-blank' }
      }, allBindings, viewModel, bindingContext)
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      return ko.bindingHandlers.component.init(element, function() {
        var depth = ko.utils.domData.get(element, 'route-depth')
        if (typeof depth !== 'number') {
          if (typeof console !== 'undefined' && typeof console.dir === 'function') {
            console.dir(element)
          }
          throw new Error('No route-depth data found on update')
        }
        return { name: typeof activeRoutes()[depth] === 'string' ? activeRoutes()[depth] : 'route-loading' }
      }, allBindings, viewModel, bindingContext)
    }
  }
  ko.bindingHandlers.routeComponent.prefix = 'route-component:'

  return function knockoutCherrytreeMiddleware(transition) {
    activeRoutes(transition.routes.filter(function(route) {
      return route.options && route.options.template
    }).map(function(route) {
      var compName = ko.bindingHandlers.routeComponent.prefix + route.ancestors.concat([route.name]).join('.')
      if (!ko.components.isRegistered(compName)) {
        ko.components.register(compName, route.options)
      }
      return compName
    }))
    // return Promise.all(compNamesOrPromises.filter(function(i) { return typeof i !== 'string' }))
  }
})