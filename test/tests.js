describe('CherryTree for Knockout', function() {
  var router, $test, forums, forum, thread, login, hrefTest, goToRoute,
  location = new cherrytree.HistoryLocation()

  beforeEach(function() {
    router = new cherrytree()
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
        <h4><a data-bind="text: title.replace(\'{0}\', $route.params.threadId), routeHref: \'forumItem\'"></a></h4>\
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
      route('forums.index', forums)
      route('forums', forums, function() {
        route('forumItem', forum)
        route('threads', forum, function() {
          route('thread', thread)
        })
      })
      route('router-href-test', hrefTest)
    })

    $test = $('<div data-bind="routeView: router"></div>')
    // flush the activeRoutes() that are in the closure from previous tests
    ko.bindingHandlers.routeView.middleware({
      routes: [],
      params: {},
      query: {}
    })

    ko.applyBindings({ router: router }, $test[0])
    router.listen(location)
    $test.find('section').should.not.exist
    // return router.state.activeTransition
  })
  afterEach(function() {
    ko.cleanNode($test[0])
    $test.remove()
    window.location.hash = ''
    $test = null
    // return router.state.activeTransition
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
    $test.find('section').should.not.exist.mmmkay
  })

  it('should automatically register a component and render it', function() {
    window.location.hash = 'login'
    return pollUntilPassing(function() {
      $test.find('section.login h1').should.have.text('please login')
    })
  })

  it('should render nested components with route params', function() {
    window.location.hash = 'forums/1'
    return pollUntilPassing(function() {
      $test.find('section.forums section.forum').should.exist
      $test.find('section.forum h2').should.have.text('Viewing forum 1')
    }).then(function() {
      window.location.hash = 'forums/1/threads/2'
      return pollUntilPassing(function() {
        $test.find('section.forums section.forum section.thread').should.exist
        $test.find('section.forum h2').should.have.text('Viewing forum 1')
        $test.find('section.thread h4').should.have.text('Viewing thread 2')
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

    window.location.hash = 'login'
    return pollUntilPassing(function() {
      $test.find('section.login').should.exist
      $test.find('section.login h1').should.have.text('The login form!')
    })
  })

  it('should expose $route on the bindingContext with the route name at that depth, params, and query', function() {
    window.location.hash = 'forums/1/threads/2?unreadOnly=true'
    return pollUntilPassing(function() {
      $test.find('section.forums section.forum section.thread').should.exist
      $test.find('section.thread p').should.exist
      JSON.parse($test.find('section.thread p').text()).should.deep.equal({
        name: 'route:forums.threads.thread',
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

  it('should back router.state with an observable', function() {
    window.location.hash = 'forums/1'
    return pollUntilPassing(function() {
      var stateProp = Object.getOwnPropertyDescriptor(router, 'state')
      ko.isObservable(stateProp.get).should.be.true
      ko.isObservable(stateProp.set).should.be.true
    })
  })

  describe('routeHref', function() {
    beforeEach(function() {
      goToRoute = ko.observable({ name: 'login' })

      window.location.hash = 'href-test/foobar'
      return pollUntilPassing(function() {
        $test[0].querySelector('.href-test').should.exist
      })
    })

    it('should render a href given only the route name, if the route needs no params', function() {
      $test.find('.href-test a').should.have.attr('href', '#login')
    })

    it('should render a href given the route name and params', function() {
      goToRoute({
        name: 'thread',
        params: {
          forumId: 2,
          threadId: 3
        }
      })
      $test.find('.href-test a').should.have.attr('href', '#forums/2/threads/3')
    })

    it('should default to the same route name if given only params', function() {
      goToRoute({
        params: {
          someparam: 'baz'
        }
      })
      $test.find('.href-test a').should.have.attr('href', '#href-test/baz')
    })

    it('should accept just a string to use as the route name', function() {
      window.location.hash = 'forums/1/threads/2'
      return pollUntilPassing(function() {
        $test.find('section.thread h4 a').should.have.attr('href', '#forums/1')
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
      if (ko.components.isRegistered('route:forums.threads.thread')) {
        ko.components.unregister('route:forums.threads.thread')
      }
    })

    it('should call a resolve function during route middleware resolution and block the route transition until it resolves', function() {
      window.location.hash = 'forums'
      return pollUntilPassing(function() {
        forums.resolve.forums.should.have.been.calledOnce.mmmkay
        forums.resolve.forums.firstCall.args[0].should.contain.keys(['params', 'query', 'path', 'routes'])

        $test.find('section.forums').should.not.exist
      }).then(function() {        
        forumsDeferred.resolve([{ id: 1, name: 'Home forum' }])
        return pollUntilPassing(function() {
          forums.resolve.forums.should.have.been.calledOnce
          $test.find('section.forums').should.exist
          $test.find('.route-loading').should.not.exist
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

      window.location.hash = 'messages'
      return pollUntilPassing(function() {
        $test.find('blink').should.exist.and.have.text('loading!!!')
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

      window.location.hash = '/email-campaign/v2launch/create?title=Check%20out%20our%20new%20version!'
    })

    it('should resolve nested components in order', function() {
      window.location.hash = 'forums/1/threads/2'

      return pollUntilPassing(function() {
        forums.resolve.forums.should.have.been.calledOnce
        thread.resolve.threads.should.have.not.been.called

        $test.find('section.forums').should.not.exist
        $test.find('section.thread').should.not.exist
      }).then(function() {
        forumsDeferred.resolve([{
          name: 'Home forum'
        }, {
          name: 'Water Cooler'
        }])

        return pollUntilPassing(function() {
          $test.find('section.forums .route-loading').should.exist
          $test.find('section.thread').should.not.exist
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
          $test.find('section.forums').should.exist
          $test.find('section.forums .route-loading').should.not.exist

          var $thread = $test.find('section.forums section.thread')
          $thread.should.exist
          $thread.find('h4').should.have.text('Viewing threads for forum Water Cooler')
          $thread.find('li:first-child').should.have.text('first thread')
          $thread.find('li:nth-child(2)').should.have.text('second thread')
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

      window.location.hash = 'profile'
      accountDeferrred.resolve({ name: 'Bob' })
      return pollUntilPassing(function() {
        profileViewModel.should.have.been.calledOnce
        profileViewModel.firstCall.args[0].account.should.deep.equal({ name: 'Bob' })
      })
    })
  })
})