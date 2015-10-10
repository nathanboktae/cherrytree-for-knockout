describe('CherryTree for Knockout', function() {
  var router, location, testEl, forums, forum, thread, login, hrefTest, goToRoute

  beforeEach(function() {
    router = cherrytree({ location: 'memory' })
    router.use(ko.bindingHandlers.routeView.middleware)

    login = {
      template: '<section class="login"><h1 data-bind="text: title"></h1></section>',
      viewModel: function() {
        this.title = 'please login'
      },
      synchronous: true
    }

    forums = {
      path: 'forums',
      template: '<section class="forums"><h1>Viewing all forums</h1><div data-bind="routeView: true"></div></section>',
      viewModel: function() {},
      synchronous: true
    }

    forum = {
      path: ':forumId',
      template: '<section class="forum"><h2 data-bind="text: title.replace(\'{0}\', $route.params.forumId)"></h2><div data-bind="routeView: true"></div></section>',
      viewModel: function() {
        this.title = 'Viewing forum {0}'
      },
      synchronous: true
    }

    thread = {
      path: 'threads/:threadId',
      template: '<section class="thread">\
        <h4><a data-bind="text: title.replace(\'{0}\', $route.params.threadId), routeHref: \'threads\'"></a></h4>\
        <p data-bind="text: JSON.stringify($route)"></p></section>',
      viewModel: function() {
        this.title = 'Viewing thread {0}'
      },
      synchronous: true
    }

    hrefTest = {
      synchronous: true,
      path: 'href-test/:someparam',
      viewModel: function() {
        return { goToRoute: goToRoute }
      },
      template: '<nav class="href-test">\
          <a data-bind="routeHref: goToRoute"></a>\
        </nav>'
    }

    router.map(function(route) {
      route('login', login)
      route('forums', forums, function() {
        route('threads', forum, function() {
          route('thread', thread)
        })
      })
      route('router-href-test', hrefTest)
    })

    testEl = document.createElement('div')
    testEl.setAttribute('data-bind', 'routeView: router')
    // flush the activeRoutes() that are in the closure from previous tests
    ko.bindingHandlers.routeView.middleware({
      routes: [],
      params: {},
      query: {}
    })

    ko.applyBindings({ router: router }, testEl)
    router.listen()
    location = router.location
    should.not.exist(testEl.querySelector('section'))
    return router.state.activeTransition
  })
  afterEach(function() {
    ko.cleanNode(testEl)
    testEl = null
  })

  function pollUntilPassing(fn) {
    var resolve, reject, tries = 0

    var attempt = function() {
      tries++
      try {
        fn()
        resolve()
      } catch(e) {
        if (tries < 30) {
          setTimeout(attempt, 5)
        } else {
          reject(e)
        }
      }
    } 
    setTimeout(attempt, 2)

    return new Promise(function(r, rj) {
      resolve = r, reject = rj
    })
  }

  it('should render a blank component when no route is active', function() {
    testEl.querySelectorAll('section').length.should.equal(0)
  })

  it('should automatically register a component and render it', function() {
    location.setURL('/login')
    return pollUntilPassing(function() {
      testEl.querySelector('section.login h1').textContent.should.equal('please login')
    })
  })

  it('should render nested components with route params', function() {
    location.setURL('/forums/1')
    return pollUntilPassing(function() {
      testEl.querySelector('section.forums section.forum').should.be.ok
      testEl.querySelector('section.forum h2').textContent.should.equal('Viewing forum 1')
    }).then(function() {
      location.setURL('/forums/1/threads/2')
      return pollUntilPassing(function() {
        testEl.querySelector('section.forums section.forum section.thread').should.be.ok
        testEl.querySelector('section.forum h2').textContent.should.equal('Viewing forum 1')
        testEl.querySelector('section.thread h4').textContent.should.equal('Viewing thread 2')
      })
    })
  })

  it('should add a class on routeView element that is the component name of the current route', function() {
    router.map(function(route) {
      route('login', login)
      route('i LOVE beer!!', { path: 'so-cool', template: '<div class="kewl" data-bind="routeView: true"></div>' }, function() {
        route('🍻#ch33rs🍻', { path: 'cheers', template: '<div></div>' })
      })
    })
    testEl.className = 'existing-class'

    location.setURL('/login')
    return pollUntilPassing(function() {
      testEl.className.should.equal('existing-class route-login')
    }).then(function() {
      location.setURL('/so-cool')
      return pollUntilPassing(function() {
        testEl.className.should.equal('existing-class route-i-love-beer--')
      })
    }).then(function() {
      location.setURL('/so-cool/cheers')
      return pollUntilPassing(function() {
        testEl.className.should.equal('existing-class route-i-love-beer--')
        testEl.querySelector('.kewl').className.should.equal('kewl route----ch33rs--')
      })
    })
  })

  it('should not register components already registered', function() {
    ko.components.unregister('route:login')
    ko.components.register('route:login', {
      template: login.template,
      viewModel: function() {
        this.title = 'The login form!'
      },
      synchronous: true
    })

    location.setURL('/login')
    return pollUntilPassing(function() {
      testEl.querySelector('section.login').should.be.ok
      testEl.querySelector('section.login h1').textContent.should.equal('The login form!')
    })
  })

  it('should expose $route on the bindingContext with the route name at that depth, params, and query', function() {
    location.setURL('/forums/1/threads/2?unreadOnly=true')
    return pollUntilPassing(function() {
      testEl.querySelector('section.forums section.forum section.thread').should.be.ok
      testEl.querySelector('section.thread p').should.be.ok
      JSON.parse(testEl.querySelector('section.thread p').textContent).should.deep.equal({
        name: 'route:thread',
        params: {
          forumId: '1',
          threadId: '2'
        },
        query: {
          unreadOnly: 'true'
        }
      })
    })
  })

  it('should expose the route component as $routeComponent', function() {
    ko.components.register('some-component', {
      template: '<div class="route-comp-test" data-bind="text: $routeComponent.foo"></div>'
    })
    router.map(function(route) {
      route('routecomp', {
        viewModel: function() {
          this.foo = 'bar'
        },
        template: '<some-component></some-component>'
      })
    })

    location.setURL('/routecomp')
    return pollUntilPassing(function() {
      testEl.querySelector('.route-comp-test').textContent.should.equal('bar')
    })
  })

  describe('idempotency', function() {
    it('should not re-render parents when navigating down to children', function() {
      location.setURL('/forums/1')
      return pollUntilPassing(function() {
        testEl.querySelector('section.forums section.forum').should.be.ok
      }).then(function() {
        testEl.querySelector('section.forums section.forum').foo = 'bar'
        location.setURL('/forums/1/threads/2')
        return pollUntilPassing(function() {
          testEl.querySelector('section.forums section.forum section.thread').should.be.ok
        })
      }).then(function() {
        testEl.querySelector('section.forums section.forum').should.have.property('foo')
      })
    })

    it('should not re-render parents when navigating to adjacent children', function() {
      location.setURL('/forums/1/threads/2')
      return pollUntilPassing(function() {
        testEl.querySelector('section.thread h4').textContent.should.equal('Viewing thread 2')
      }).then(function() {
        testEl.querySelector('section.forums section.forum').foo = 'bar'
        location.setURL('/forums/1/threads/4')
        return pollUntilPassing(function() {
          testEl.querySelector('section.thread h4').textContent.should.equal('Viewing thread 4')
        })
      }).then(function() {
        testEl.querySelector('section.forums section.forum').should.have.property('foo')
      })
    })
  })

  describe('routeHref', function() {
    beforeEach(function() {
      goToRoute = ko.observable({ name: 'login' })

      location.setURL('/href-test/foobar')
      return pollUntilPassing(function() {
        testEl.querySelector('.href-test').should.be.ok
      })
    })

    it('should render a href given only the route name, if the route needs no params', function() {
      testEl.querySelector('.href-test a').should.have.attr('href', '/login')
    })

    it('should render a href given the route name and params', function() {
      goToRoute({
        name: 'thread',
        params: {
          forumId: 2,
          threadId: 3
        }
      })
      testEl.querySelector('.href-test a').should.have.attr('href', '/forums/2/threads/3')
    })

    it('should default to the same route name if given only params', function() {
      goToRoute({
        params: {
          someparam: 'baz'
        }
      })
      testEl.querySelector('.href-test a').should.have.attr('href', '/href-test/baz')
    })

    it('should accept just a string to use as the route name', function() {
      location.setURL('/forums/1/threads/2')
      return pollUntilPassing(function() {
        testEl.querySelector('section.thread h4 a').should.have.attr('href', '/forums/1')
      })
    })
  })

  describe('resolve', function() {
    var forumsDeferred, threadsDeferred
    function defer() {
      var d = {}
      d.promise = new Promise(function(resolve) {
          d.resolve = resolve
      })
      return d
    }

    beforeEach(function() {
      forumsDeferred = defer()
      threadsDeferred = defer()

      forums.resolve = {
        forums: sinon.spy(function() {
          return forumsDeferred.promise
        })
      }

      delete thread.viewModel
      thread.resolve = {
        forum: function(transition, resolutions) {
          return resolutions.forums[transition.params.forumId]
        },
        threads: sinon.spy(function() {
          return threadsDeferred.promise
        })
      }
      thread.viewModel = {
        createViewModel: function(params) {
          params.$route.should.contain.keys(['query', 'params', 'transitionTo'])
          return {
            title: 'Viewing threads for forum ' + params.forum.name,
            threads: params.threads
          }
        }
      }
      thread.template = '\
        <section class="thread">\
          <h4 data-bind="text: title"></h4>\
          <ul data-bind="foreach: threads">\
            <li data-bind="text: title"></li>\
          </ul>\
        </section>'

      if (ko.components.isRegistered('route:forums')) {
        ko.components.unregister('route:forums')
      }
      if (ko.components.isRegistered('route:thread')) {
        ko.components.unregister('route:thread')
      }
    })

    it('should call a resolve function during route middleware resolution and block the route transition until it resolves', function() {
      location.setURL('/forums')
      return pollUntilPassing(function() {
        forums.resolve.forums.should.have.been.calledOnce.mmmkay
        forums.resolve.forums.firstCall.args[0].should.contain.keys(['params', 'query', 'path', 'routes'])

        testEl.querySelectorAll('section.forums').length.should.equal(0)
      }).then(function() {        
        forumsDeferred.resolve([{ id: 1, name: 'Home forum' }])
        return pollUntilPassing(function() {
          forums.resolve.forums.should.have.been.calledOnce
          testEl.querySelector('section.forums').should.be.ok
          testEl.querySelectorAll('.route-loading').length.should.equal(0)
        })
      })
    })

    it('can have the loading component replaced by a custom component', function() {
      ko.components.unregister('route-loading')
      ko.components.register('route-loading', {
        template: '<blink class="route-loading">loading!!!</blink>'
      })

      router.map(function(route) {
        route('messages', {
          resolve: {
            messages: function() { return defer().promise }
          },
          template: '<div class="mesasges"></div>'
        })
      })

      location.setURL('/messages')
      return pollUntilPassing(function() {
        testEl.querySelector('blink').should.be.ok.and.have.text('loading!!!')
      })
    })

    it('should provide the route as a param even with no resolve functions', function(done) {
      router.map(function(route) {
        route('email-campaign', {
          path: 'email-campaign/:campaign/create',
          template: '<div class="campaign"></div>',
          viewModel: {
            createViewModel: function(params) {
              try {
                params.$route.params.campaign.should.equal('v2launch')
                params.$route.query.should.deep.equal({ title: 'Check out our new version!' })
                setTimeout(done, 1)
              } catch (e) {
                done(e)
              }
              return {}
            }
          }
        })
      })

      location.setURL('/email-campaign/v2launch/create?title=Check%20out%20our%20new%20version!')
    })

    it('should resolve nested components in order', function() {
      location.setURL('/forums/1/threads/2')

      return pollUntilPassing(function() {
        forums.resolve.forums.should.have.been.calledOnce
        thread.resolve.threads.should.have.not.been.called

        testEl.querySelectorAll('section.forums').length.should.equal(0)
        testEl.querySelectorAll('section.thread').length.should.equal(0)
      }).then(function() {
        forumsDeferred.resolve([{
          name: 'Home forum'
        }, {
          name: 'Water Cooler'
        }])

        return pollUntilPassing(function() {
          testEl.querySelector('section.forums .route-loading').should.be.ok
          testEl.querySelectorAll('section.thread').length.should.equal(0)
          thread.resolve.threads.should.have.been.calledOnce
          thread.resolve.threads.firstCall.args[0].params.should.deep.equal({
            forumId: '1',
            threadId: '2'
          })
          thread.resolve.threads.firstCall.args[1].should.deep.equal({
            forums: [{
              name: 'Home forum'
            }, {
              name: 'Water Cooler'
            }]
          })
        })
      }).then(function() {
        threadsDeferred.resolve([{
          title: 'first thread'
        }, {
          title: 'second thread'
        }])

        return pollUntilPassing(function() {
          thread.resolve.threads.should.have.been.calledOnce
          testEl.querySelector('section.forums').should.be.ok
          testEl.querySelectorAll('section.forums .route-loading').length.should.equal(0)

          var threadSection = testEl.querySelector('section.forums section.thread')
          threadSection.should.be.ok
          threadSection.querySelector('h4').textContent.should.equal('Viewing threads for forum Water Cooler')
          threadSection.querySelector('li:first-child').textContent.should.equal('first thread')
          threadSection.querySelector('li:nth-child(2)').textContent.should.equal('second thread')
        })
      })
    })

    it('should provide existing resolutions if parent routes did not change', function() {
      location.setURL('/forums/1/threads/2')
      forumsDeferred.resolve([{
        name: 'Home forum'
      }, {
        name: 'Water Cooler'
      }])
      threadsDeferred.resolve([{
        title: 'first thread'
      }, {
        title: 'second thread'
      }])

      return pollUntilPassing(function() {
        forums.resolve.forums.should.have.been.calledOnce
        thread.resolve.threads.should.have.been.calledOnce

        testEl.querySelector('section.forums section.thread h4').textContent.should.equal('Viewing threads for forum Water Cooler')
      }).then(function() {
        threadsDeferred = defer()
        threadsDeferred.resolve([{
          title: 'another thread'
        }])
        location.setURL('/forums/1/threads/4')

        return pollUntilPassing(function() {
          forums.resolve.forums.should.have.been.calledOnce
          thread.resolve.threads.should.have.been.calledTwice

          testEl.querySelector('section.forums section.thread h4').textContent.should.equal('Viewing threads for forum Water Cooler')
          testEl.querySelector('section.thread li:first-child').textContent.should.equal('another thread')
        })
      })
    })

    it('should resolve items in routes without components', function() {
      var
        accountDeferrred = defer(),
        orderHistoryDeferred = defer(),
        profileViewModel = sinon.spy(function() {
          return {}
        }),
        orderHistoryViewModel = sinon.spy(function() {
          return {}
        })

      router.map(function(route) {
        route('account', {
          resolve: {
            account: function() {
              return accountDeferrred.promise
            }
          }
        }, function() {
          route('profile', {
            path: '/profile',
            viewModel: {
              createViewModel: profileViewModel
            },
            template: '<div class="profile"></div>'
          })
          route('order-history', {
            resolve: {
              orderHistory: function() { return orderHistoryDeferred.promise }
            },
            viewModel: {
              createViewModel: orderHistoryViewModel
            },
            template: '<div class="order-history"></div>'
          })
        })
      })

      location.setURL('/profile')
      accountDeferrred.resolve({ name: 'Bob' })
      return pollUntilPassing(function() {
        profileViewModel.should.have.been.calledOnce
        profileViewModel.firstCall.args[0].account.should.deep.equal({ name: 'Bob' })
      })
    })
  })
})