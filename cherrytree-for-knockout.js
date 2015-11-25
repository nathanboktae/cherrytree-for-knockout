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
  var activeRoutes = ko.observableArray(), transitioning, router

  ko.components.register('route-blank', {
    template: '<div></div>',
    synchronous: true
  })

  ko.components.register('route-loading', {
    template: '<div class="route-loading"></div>',
    synchronous: true
  })

  function extend(target, obj) {
    return Object.keys(obj).reduce(function(t, key) {
      t[key] = obj[key]
      return t
    }, target)
  }

  var origCreatChildContext = ko.bindingContext.prototype.createChildContext

  // a bit of a hack, but since the component binding instantiates the component,
  // likely async too, and no way to walk down binding contexts.
  // we are extending the component context
  ko.bindingContext.prototype.createChildContext = function(dataItemOrAccessor, dataItemAlias, extendCallback) {
    return origCreatChildContext.call(this, dataItemOrAccessor, dataItemAlias, function(ctx) {
      var retval = typeof extendCallback === 'function' && extendCallback(ctx)
      if (ctx && ctx.$parentContext && ctx.$parentContext._routeCtx) {
        delete ctx.$parentContext._routeCtx
        ctx.$route = ctx._routeCtx
        delete ctx._routeCtx
        ctx.$routeComponent = dataItemOrAccessor
      }
      return retval
    })
  }

  ko.bindingHandlers.routeView = {
    init: function(_, valueAccessor, __, ___, bindingContext) {
      var r = valueAccessor()
      if (r && typeof r.map === 'function' && typeof r.use === 'function') {
        router = r
        if (!bindingContext.$root.router) {
          bindingContext.$root.router = r
        }
        if (!bindingContext.$root.activeRoutes) {
          bindingContext.$root.activeRoutes = activeRoutes
          bindingContext.$leafRoute = function() {
            return activeRoutes()[activeRoutes().length - 1]
          }
        }
      }

      return { controlsDescendantBindings: true }
    },
    update: function(element, valueAccessor, ab, vm, bindingContext) {
      var depth = 0, contextIter = bindingContext,
      routeComponent = ko.observable({ name: 'route-blank' }),
      prevRoute, routeClass

      while (contextIter.$parentContext && contextIter.$routeComponent !== contextIter.$parentContext.$routeComponent) {
        depth++
        contextIter = contextIter.$parentContext
      }

      ko.computed(function() {
        var route = activeRoutes()[depth]
        if (route == prevRoute) return
        if (!route) {
          routeComponent({ name: 'route-blank' })
          return
        }

        bindingContext._routeCtx = route

        var res = route.resolutions()
        if (res) {
          var params = extend({}, res)
          params.$route = extend({}, route)
          delete params.$route.resolutions

          if (route.queryParams) {
            extend(params, route.queryParams)
          }

          prevRoute = route
          routeComponent({ name: ko.bindingHandlers.routeView.prefix + route.name, params: params })
        } else {
          routeComponent({ name: 'route-loading' })
        }
      }, null, { disposeWhenNodeIsRemoved: element }).extend({ rateLimit: 5 })

      ko.computed(function() {
        var newClass = routeComponent().name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
        if (newClass === routeClass) return
        if (routeClass) {
          element.classList.remove(routeClass)
        }

        routeClass = newClass
        element.classList.add(routeClass)
      }, null, { disposeWhenNodeIsRemoved: element })

      return ko.bindingHandlers.component.init(element, routeComponent, ab, vm, bindingContext)
    }
  }
  ko.bindingHandlers.routeView.prefix = 'route:'

  function mapQuery(queryParams) {
    return queryParams != null && Object.keys(queryParams).reduce(function(q, k) {
      q[k] = ko.unwrap(queryParams[k])
      return q
    }, {})
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
    var routes = activeRoutes(),
    query = routes.reduce(function(q, route) {
      if (route.queryParams) {
        Object.keys(route.queryParams).forEach(function(key) {
          var val = route.queryParams[key]()
          if (val !== route.queryParams[key].default) {
            q[key] = val
          } else {
            delete q[key]
          }
        })
      }
      return q
    }, extend({}, routes.length ? routes[routes.length - 1].query : {}))

    if (transitioning) return
    if (transitioning !== false) {
      transitioning = false
      return
    }

    var url = router.location.getURL(),
        stringified = router.options.qs.stringify(query)
    router.location.setURL(url.split('?')[0] + (stringified ? '?' + stringified : ''))
  })

  function updateQueryParams(route, query) {
    if (route.queryParams) {
      Object.keys(route.queryParams).forEach(function(key) {
        var observable = route.queryParams[key]
        if (key in query) {
          observable(query[key])
        } else {
          observable(Array.isArray(observable.default) ? observable.default.slice() : observable.default)
        }
      })
    }
  }

  function routeEqual(comp, route) {
    if (!comp || !route || comp.name !== route.name) return false

    return Object.keys(route.params).every(function(param) {
      return comp.params[param] === route.params[param]
    })
  }

  return function knockoutCherrytreeMiddleware(transition) {
    var resolutions = {}, routeResolvers = [], startIdx = 0,
    filteredRoutes = transition.routes.filter(function(route) {
      return route.options && !!(route.options.template || route.options.resolve)
    })
    transitioning = true // router.state.activeTransition isn't set to this one yet

    while (routeEqual(activeRoutes()[startIdx], filteredRoutes[startIdx])) {
      Object.assign(resolutions, activeRoutes()[startIdx].resolutions())
      updateQueryParams(activeRoutes()[startIdx], transition.query)
      startIdx++
    }

    var newRoutes = filteredRoutes.slice(startIdx).map(function(route) {
      var routeData
      if (route.options.template) {
        routeData = {
          name: route.name,
          params: transition.params,
          query: transition.query,
          resolutions: ko.observable(),
          transitionTo: function(name, params, query) {
            return query === true ?
              transition.redirectTo(name, params, mapQuery(routeData.queryParams)) :
              transition.redirectTo.apply(transition, arguments)
          }
        }

        var compName = ko.bindingHandlers.routeView.prefix + routeData.name
        if (!ko.components.isRegistered(compName)) {
          ko.components.register(compName, route.options)
        }

        var query = route.options.query
        if (query) {
          routeData.queryParams = Object.keys(query).reduce(function(q, key) {
            var queryVal = routeData.query[key], defaultVal = query[key]
            if (!Array.isArray(defaultVal)) {
              q[key] = ko.observable(queryVal !== undefined ? queryVal : defaultVal)
              q[key].default = defaultVal
            } else {
              if (queryVal) {
                q[key] = ko.observableArray(Array.isArray(queryVal) ? queryVal : [queryVal])
              } else {
                q[key] = ko.observableArray(defaultVal)
              }
              q[key].default = defaultVal.splice()
            }
            return q
          }, {})
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
})