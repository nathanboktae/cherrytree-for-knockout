describe('CherryTree for Knockout', function() {
  var router, $test, observer, forums, forum, thread, login,
  location = new cherrytree.HistoryLocation()

  beforeEach(function() {
    router = new cherrytree()
    router.use(ko.bindingHandlers.routeComponent.middleware)

    login = {
      template: '<section class="login"><h1 data-bind="text: title"></h1></section>',
      viewModel: function() {
        this.title = 'please login'
      },
      synchronous: true
    }

    forums = {
      path: 'forums',
      template: '<section class="forums"><h1>Viewing all forums</h1><div data-bind="routeComponent: true"></div></section>',
      viewModel: function() {},
      synchronous: true
    }

    forum = {
      path: ':forumId',
      template: '<section class="forum"><h2 data-bind="text: title.replace(\'{0}\', $route.params.forumId)"></h2><div data-bind="routeComponent: true"></div></section>',
      viewModel: function() {
        this.title = 'Viewing forum {0}'
      },
      synchronous: true
    }

    thread = {
      path: 'threads/:threadId',
      template: '<section class="thread"><h4 data-bind="text: title.replace(\'{0}\', $route.params.threadId)"></h4><p data-bind="text: JSON.stringify($route)"></p></section>',
      viewModel: function() {
        this.title = 'Viewing thread {0}'
      },
      synchronous: true
    }

    router.map(function(route) {
      route('login', login)
      route('forumList', forums)
      route('forums', forums, function() {
        route('forumItem', forum)
        route('threads', forum, function() {
          route('thread', thread)
        })
      })
    })

    $test = $('<div data-bind="routeComponent: true"></div>')
    // flush the activeRoutes() that are in the closure from previous tests
    ko.bindingHandlers.routeComponent.middleware({
      routes: [],
      params: {},
      query: {}
    })

    ko.applyBindings({}, $test[0])
    router.listen(location)
    $test.find('section').should.not.exist
  })
  afterEach(function() {
    console.log($test[0])
    observer && observer.disconnect()
    ko.cleanNode($test[0])
    $test.remove()
    window.location.hash = ''
    $test = null
  })

  function waitFor(klass, cb, done, onlyOnFail) {
    observer = new MutationObserver(function(mutations) {
      mutations.forEach(function (mutation) {
        // jQuery causes muations with .find, so we can't use it
        if (mutation.target.classList.contains(klass) ||
            (mutation.target.innerHTML || '').indexOf('class="' + klass + '"') >= 0) {
          try {
            observer.disconnect()
            cb()
            if (!onlyOnFail) done()
          } catch(e) {
            done(e)
          }
        }
      })
    })
    observer.observe($test[0], {
      childList: true,
      subtree: true,
      attributes: true
    })
  }

  it('should render a blank component when no route is active', function() {
    $test.find('section').should.not.exist.mmmkay
  })

  it('should automatically register a component and render it', function(done) {
    window.location.hash = 'login'
    waitFor('login', function() {
      $test.find('section.login h1').should.have.text('please login')
    }, done)
  })

  it('should render nested components with route params', function(done) {
    window.location.hash = 'forums/1'
    waitFor('forum', function() {
      $test.find('section.forums section.forum').should.exist
      $test.find('section.forum h2').should.have.text('Viewing forum 1')

      window.location.hash = 'forums/1/threads/2'
      waitFor('forum', function() {
        $test.find('section.forums section.forum section.thread').should.exist
        $test.find('section.forum h2').should.have.text('Viewing forum 1')
        $test.find('section.thread h4').should.have.text('Viewing thread 2')
      }, done)
    }, done, true)
  })

  it('should not register components already registered', function(done) {
    ko.components.unregister('route:login')
    ko.components.register('route:login', {
      template: login.template,
      viewModel: function() {
        this.title = 'The login form!'
      },
      synchronous: true
    })

    window.location.hash = 'login'
    waitFor('login', function() {
      $test.find('section.login').should.exist
      $test.find('section.login h1').should.have.text('The login form!')
    }, done)
  })

  it('should expose $route on the bindingContext with the route name at that depth, params, and query', function(done) {
    window.location.hash = 'forums/1/threads/2?unreadOnly=true'
    waitFor('thread', function() {
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
    }, done)
  })

  describe('resolve', function() {
    it('should call a resolve function during route middleware resolution and block the route transition until it resolves')
    it('should render the loading component during route transitions')
    it('can have the loading component replaced by a custom component')
    it('should not block route transition if the return result is not a promise')
  })
})