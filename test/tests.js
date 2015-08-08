describe('CherryTree for Knockout', function() {
  var router, $test, observer, forums, threads, post, login,
  location = new cherrytree.HistoryLocation()

  beforeEach(function() {
    router = new cherrytree()
    router.use(ko.bindingHandlers.routeComponent.middleware)

    login = {
      template: '<section class="login"><h1 data-bind="text: title"></h1></section>',
      viewModel: function() {
        this.title = 'please login'
      },
      syncronous: true
    }

    forums = {
      path: 'forum/:id',
      template: '<section class="forum"><h1 data-bind="text: title.replace(\'{0}\', $route)"></h1></section>',
      viewModel: function() {
        this.title = 'viewing forum {0}'
      },
      syncronous: true
    }

    threads = {
      path: 'thread/:id',
      template: '<section class="thread"><h1 data-bind="text: title.replace(\'{0}\', $route)"></h1></section>',
      viewModel: function() {
        this.title = 'viewing thread {0}'
      },
      syncronous: true
    }

    router.map(function(route) {
      route('login', login)
      route('forum', forums, function() {
        route('thread', threads)
      })
    })

    $test = $('<div data-bind="routeComponent: true"></div>')
    ko.applyBindings({}, $test[0])
    router.listen(location)
    $test.find('section').should.not.exist
  })
  afterEach(function() {
    window.location.hash = ''
    observer && observer.disconnect()
  })

  function waitFor(klass, cb, done) {
    observer = new MutationObserver(function(mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.target.classList.contains(klass) ||
            (mutation.target.innerHTML || '').indexOf('class="' + klass + '"') >= 0) {
          try {
            observer.disconnect()
            cb()
            done()
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

  it('should not register components already registered', function(done) {
    ko.components.unregister('route-component:login')
    ko.components.register('route-component:login', {
      template: login.template,
      viewModel: function() {
        this.title = 'The login form!'
      }
    })

    window.location.hash = 'login'
    waitFor('login', function() {
      $test.find('section.login').should.exist
      $test.find('section.login h1').should.have.text('The login form!')
    }, done)
  })

  it('should render nested components with route params')
  it('should change the component to match the route when the route changes')
  it('should dispose nested components in reverse order when a top level route changes')
  it('should expose $route that is an observable of the route name (or params? both?) at that depth')

  describe('resolve', function() {
    it('should call a resolve function during route middleware resolution and block the route transition until it resolves')
    it('should render the loading component during route transitions')
    it('can have the loading component replaced by a custom component')
    it('should not block route transition if the return result is not a promise')
  })
})