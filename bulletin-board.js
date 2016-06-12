var demoSite = {
  // we mark this abstract as we don't want this page to be routable directly, only it's children
  abstract: true,
  path: '/',
  // we declare any data that needs to be resolved or injected into the view model constructor
  // in the resolve block here. Promises are used as most often this is where you
  // need to fetch something from the server before rendering or loading the view.
  resolve: {
    forums: function(transition, resolutions) {
      // query the server for all the forums.
      // return axios.get(....).then(r => r.data)
      return Promise.resolve([{
        id: 7,
        name: 'cherrytree-for-knockout demo forum'
      }])
    }
  },
  // in the real world you would import your templates through your favorite module system
  // like `require('text!./forum-templates.html')`
  // only the root routeView binding needs to be passed the router. Nested routeViews do not need any options.
  template: '\
<section class="demo-site">\
  <h1 data-bind="text: header"></h1>\
  <div data-bind="routeView: true"></div>\
</section>',
  // view models are called with new, but you can just return an object as seen below.
  viewModel: function() {
    this.header = 'A forum board example'
  }
},

forumList = {
  path: '',
  // the routeHref binding is an easy way to generate a link to another route.
  template: '\
<ul class="forums" data-bind="foreach: forums">\
  <li><a data-bind="routeHref: { name: \'threads.list\', params: { forumId: id } }, text: name"></a></li>\
</ul>\
',
  // you can just sreturn the params if there is nothing else to add.
  viewModel: function(params) {
   return params
  }
},

forum = {
  // paths are relative extentions of where they are used, for better composability
  path: ':forumId',
  abstract: true,
  template: '\
<section class="forum">\
  <h2 data-bind="text: title"></h2>\
  <div data-bind="routeView: true"></div>\
</section>',
  resolve: {
    forum: (t, r) => Promise.resolve(r.forums.find(f => f.id == t.params.forumId)),
    threads: function(transition, resolutions) {
      // query the server for the threads in this forum, e.g.
      // return axios.get(....).then(r => r.data)
      return Promise.resolve([{
        id: 1,
        name: 'Welcome to the forums!'
      }, {
        id: 2,
        name: 'A newbie question...'
      }])
    }
  },
  viewModel: function(params, route) {
    this.title = 'Viewing forum ' + params.forum.name
  }
},

threadsList = {
  // when
  template: '\
<ul class="threads" data-bind="foreach: threads">\
  <li><a data-bind="routeHref: { name: \'thread\', params: { threadId: id } }, text: name"></a></li>\
</ul>',
  viewModel: function(params) {
    return params
  }
},

thread = {
  resolve: {
    thread: (tr, r) => Promise.resolve(r.threads.find(t => t.id == tr.params.threadId)),
    posts: function(transition, resolutions) {
      // Again this would be queried from the server
      // return axios.get(....).then(r => r.data)
      return Promise.resolve([{
        author: 'Bob',
        text: 'Sample post'
      }, {
        author: 'Jill',
        text: 'Sample reply'
      }, {
        author: 'Bob',
        text: 'Thank you!'
      }])
    }
  },
  path: 'threads/:threadId',
  // if you use routeHref with just a string, it will use that as the route name and reuse the current params
  template: '\
    <section class="thread">\
      <nav><a data-bind="routeHref: \'threads.list\'">Back to <span data-bind="text: forum.name"></span></a></nav>\
      <h4 data-bind="text: thread.title"></h4>\
      <ul data-bind="foreach: posts">\
        <span class="author" data-bind="text: author"></span>\
        <li data-bind="text: text"></li>\
      </ul>\
    </section>',
  viewModel: function(params, route) {
    Object.assign(this, params)
  }
},

router = cherrytree({ pushState: false })

router.map(function(route) {
  route('demo-site', demoSite, function() {
    route('forums.list', forumList)
    route('forum', forum, function() {
      route('threads.list', threadsList)
      route('thread', thread)
    })
  })
})

router.use(ko.bindingHandlers.routeView.middleware)
router.listen()


ko.applyBindings({ router: router }, document.querySelector('main'))