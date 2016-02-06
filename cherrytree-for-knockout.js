(function(factory) {
  if (typeof define === 'function' && define.amd) {
    define(['knockout'], factory)
  } else if (typeof exports === 'object' && typeof module === 'object') {
    module.exports = factory
  } else {
    var middleware = factory(ko)
    ko.bindingHandlers.routeView.middleware = middleware
  }
})(function(ko) {
  var transitioning, pendingQueryStringWrite,
      router,
      templates = {},
      viewModels = {},
      activeRoutes = ko.observableArray()

  function extend(target, obj) {
    return Object.keys(obj).reduce(function(t, key) {
      t[key] = obj[key]
      return t
    }, target)
  }

  ko.bindingHandlers.routeView = {
    init: function(element, valueAccessor, __, ___, bindingContext) {
      var r = valueAccessor()
      if (r && typeof r.map === 'function' && typeof r.use === 'function') {
        router = r
        if (!bindingContext.$root.router) {
          bindingContext.$root.router = r
        }
        if (!bindingContext.$root.activeRoutes) {
          bindingContext.$root.activeRoutes = knockoutCherrytreeMiddleware.activeRoutes
          bindingContext.$leafRoute = function() {
            return activeRoutes()[activeRoutes().length - 1]
          }
        }
      }

      var depth = 0, contextIter = bindingContext,
          prevRoute, routeClass

      while (contextIter.$parentContext && contextIter.$route !== contextIter.$parentContext.$route) {
        depth++
        contextIter = contextIter.$parentContext
      }

      function setRouteName(name) {
        if (element.nodeType !== 8) {
          var newClass = name && name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
          if (newClass === routeClass) return
          if (routeClass) {
            element.classList.remove(routeClass)
          }

          routeClass = newClass
          element.classList.add(routeClass)
        }
      }

      function disposePrevRouteIfNeeded() {
        if (prevRoute && prevRoute.$root && typeof prevRoute.$root.dispose === 'function') {
          prevRoute.$root.dispose()
        }
      }

      ko.computed(function() {
        var route = activeRoutes()[depth]
        if (route == prevRoute) return

        disposePrevRouteIfNeeded()
        if (!route) {
          ko.utils.emptyDomNode(element)
          setRouteName()
          return
        }

        var res = route.resolutions()
        if (res) {
          if (viewModels[route.name]) {
            var params = extend({}, res),
                routeCopy = extend({}, route)
            delete routeCopy.resolutions
            extend(params, route.queryParams)

            route.$root = new viewModels[route.name](params, routeCopy, element)
          }
          prevRoute = route

          ko.virtualElements.setDomNodeChildren(element, ko.utils.cloneNodes(templates[route.name]))
          var childCtx = bindingContext.createChildContext(route.$root, null, function(context) {
            context.$route = route
          })
          setRouteName('route-' + route.name)
          ko.applyBindingsToDescendants(childCtx, element)

          if (route.$root) {
            knockoutCherrytreeMiddleware.activeRoutes.notifySubscribers(activeRoutes().slice())
          }
        } else {
          setRouteName('route-loading')
          ko.virtualElements.setDomNodeChildren(element, [ko.bindingHandlers.routeView.routeLoading.cloneNode(true)])
        }
      }, null, { disposeWhenNodeIsRemoved: element }).extend({ rateLimit: 5 })

      ko.utils.domNodeDisposal.addDisposeCallback(element, disposePrevRouteIfNeeded)

      return { controlsDescendantBindings: true }
    }
  }
  ko.virtualElements.allowedBindings.routeView = true

  ko.bindingHandlers.routeView.routeLoading = document.createElement('div')
  ko.bindingHandlers.routeView.routeLoading.className = 'route-loading'

  function mapQuery(queryParams, query) {
    return Object.keys(queryParams).reduce(function(q, k) {
      var val = queryParams[k]()
      if (val !== queryParams[k].default) {
        q[k] = val
      } else {
        delete q[k]
      }
      return q
    }, query || {})
  }

  ko.bindingHandlers.routeHref = {
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
      if (!router) {
        throw new Error('No router found on the root binding context. Make sure to initialize the toplevel routeView with your router as the option.')
      }

      return ko.bindingHandlers.attr.update(element, function() {
        var opts = ko.unwrap(valueAccessor()), name, params, query
        if (typeof opts === 'string') {
          name = opts
        } else if (opts) {
          name = ko.unwrap(opts.name)
          params = ko.unwrap(opts.params)
          query = ko.unwrap(opts.query)
          if (query === true) {
            query = mapQuery(bindingContext.$route.queryParams)
          }
        }

        return {
          href: opts && router.generate(
            name || bindingContext.$route.name,
            params || bindingContext.$route.params,
            query)
        }
      }, allBindings, viewModel, bindingContext)
    }
  }

  ko.computed(function bindToQueryString() {
    var routes = activeRoutes()
    if (!routes.length) return

    var lastRoute = routes[routes.length - 1],
        query = mapQuery(lastRoute.queryParams, extend({}, lastRoute.query)),
        stringified = router.options.qs.stringify(query)

    if (transitioning) return
    if (transitioning !== false) {
      transitioning = false
      return
    }

    var url = router.location.getURL()
    pendingQueryStringWrite = true
    router.location.replaceURL(url.split('?')[0] + (stringified ? '?' + stringified : ''))
  })

  function updateQueryParams(route, query) {
    if (pendingQueryStringWrite) {
      pendingQueryStringWrite = false
      return
    }
    Object.keys(route.queryParams).forEach(function(key) {
      var observable = route.queryParams[key]
      if (key in query) {
        observable(query[key])
      } else {
        observable(Array.isArray(observable.default) ? observable.default.slice() : observable.default)
      }
    })
  }

  function routeEqual(comp, route) {
    if (!comp || !route || comp.name !== route.name) return false

    if ('resolutions' in comp && !comp.resolutions()) return false

    return Object.keys(route.params).every(function(param) {
      return comp.params[param] === route.params[param]
    })
  }

  function knockoutCherrytreeMiddleware(transition) {
    var resolutions = {}, routeResolvers = [], queryParams = {}, startIdx = 0,
    filteredRoutes = transition.routes.filter(function(route) {
      return route.options && !!(route.options.template || route.options.resolve)
    })
    transitioning = true // router.state.activeTransition isn't set to this one yet

    while (routeEqual(activeRoutes()[startIdx], filteredRoutes[startIdx])) {
      Object.assign(resolutions, activeRoutes()[startIdx].resolutions())
      startIdx++
    }

    var lastSkipped = activeRoutes()[startIdx - 1]
    if (lastSkipped) {
      transition.query && updateQueryParams(lastSkipped, transition.query)
      queryParams = extend({}, lastSkipped.queryParams)
    }

    var newRoutes = filteredRoutes.slice(startIdx).map(function(route) {
      var routeData
      if (route.options.template) {
        if (!templates[route.name]) {
          templates[route.name] = ko.utils.parseHtmlFragment(route.options.template)
          viewModels[route.name] = route.options.viewModel
        }

        routeData = {
          name: route.name,
          params: transition.params,
          query: transition.query,
          queryParams: queryParams,
          resolutions: ko.observable(),
          transitionTo: function(name, params, query) {
            return query === true ?
              transition.redirectTo(name, params, mapQuery(routeData.queryParams)) :
              transition.redirectTo.apply(transition, arguments)
          }
        }

        var query = route.options.query
        if (query) {
          Object.keys(query).forEach(function(key) {
            var queryVal = routeData.query[key], defaultVal = query[key]
            if (!Array.isArray(defaultVal)) {
              queryParams[key] = ko.observable(queryVal !== undefined ? queryVal : defaultVal)
              queryParams[key].default = defaultVal
            } else {
              if (queryVal) {
                queryParams[key] = ko.observableArray(Array.isArray(queryVal) ? queryVal : [queryVal])
              } else {
                queryParams[key] = ko.observableArray(defaultVal)
              }
              queryParams[key].default = defaultVal.splice()
            }
          })

          queryParams = extend({}, queryParams)
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
    transitioning = false

    return routeResolvers.reduce(function(promise, then) {
      return promise ? promise.then(then) : then()
    }, null)
  }

  knockoutCherrytreeMiddleware.activeRoutes = ko.pureComputed(function() {
    return activeRoutes().slice()
  })

  return knockoutCherrytreeMiddleware
})