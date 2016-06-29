## CherryTree for Knockout

### Hiearchial routing for [Knockout](http://knockoutjs.com) via the [CherryTree](https://github.com/QubitProducts/cherrytree) router

[![Build Status](https://secure.travis-ci.org/nathanboktae/cherrytree-for-knockout.png?branch=master)](https://travis-ci.org/nathanboktae/cherrytree-for-knockout) [![Join the chat at https://gitter.im/nathanboktae/cherrytree-for-knockout](https://badges.gitter.im/nathanboktae/cherrytree-for-knockout.svg)](https://gitter.im/nathanboktae/cherrytree-for-knockout?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

[![SauceLabs Test Status](https://saucelabs.com/browser-matrix/Cherrytree-ko.svg)](https://saucelabs.com/u/Cherrytree-ko)

[Live Interactive Example](http://nathanboktae.github.io/cherrytree-for-knockout/)

### Overview

As you design your webapp, you will begin to identify workflows and pages in a heirachial fashion. Given the familiar forum domain, you will have a list of forums, then a list of thread in a specific form, then posts in that forum. You may also have an account page which has a private messages section. Each section will have it's own view and logic, and may need data loaded before it can be reached.

cherrytree-for-knockout helps you with all that legwork. Inspired by Knockout components, You associate view models and templates with routes that will load and display where you want in the page (you define that, and anything outside the view model for the route, like a breadcrumb bar, account dropdown that is on every page, etc is fully in your control). You can even specify data you need (any function that returns a promise) that will be provided to your view model constructor.

cherrytree-for-knockout is very lightweight, focused on one single responsibility, with under 350 lines of code. It has one job and does it well.

### Example

Specify your template and optional viewModel constructor when you map your routes like so:

```javascript
var login = {
  viewModel: function() {
    this.username = ko.observable()
    // ....
  },
  template: '<form class="login"><input name="username" data-bind="value: username"></input> .... </form>'
}

var forums = { /* ... */ }

router.map(function(route) {
  route('login', login)
  route('forums.index', forums)
  route('forums', forums, function() {
    route('forums.view', forum)
    route('threads', forum, function() {
      route('thread', thread)
    })
  })
})
```

Now for the HTML:

```html
<body>
  <header>
    <ul data-bind="foreach: $root.activeRoutes()">
      <li data-bind="routeHref: name, text: name"></li>
    </ul>
    <a class="signout" data-bind="click: signout"></a>
  </header>
  <main data-bind="routeView: router"></main>
  <script>
    ko.applyBindings({
      router: router,
      signout: function() { /* ... */ }
    })
  </script>
</body>
```

Notice the `routeView` binding. This is where your route will be rendered. In the top level `routeView` binding, you must provide the router instance. This will be available on the root view model as `router`. For nested `routeView`s, the parameter is currently ignored so `true` or `{}` will suffice.

Above `main` there is a header which creates a breadcrumb of the active routes. `activeRoutes` is added onto the $root of your view model by `cherrytree-for-knockout`. `routeHref` is a binding handler that will set the `href` for the route you specify via `router.generate`

Below that is a signout button with a click handler, showing that cherrytree-for-knockout plugs into your existing app how you wish, and ultimately your are still in control of your application's layout and workflow.

When writing your view markup, you can access the route view model at `$route.$root`.

### Resolutions

Routes in complex applications will have dependencies that need to be satisfied in order to build a view model. You can specify these dependencies by specifying a `resolve` object. The keys can be anything, with the values as a function, that given previous resolutions and the transition, return a promise. When the route loads, the functions will be called with the current transition and any resolutions before it. Then the view model constructor will be given the all the resolutions together as the first parameter

```javascript
var forums = {
  resolve: {
    forums: function(resolutions, transition) {
      return http.get('/forums').then(resp => resp.data)
    }
  }
  template: '<ul class="forums" data-bind="foreach: $route.resolutions().forums">\
<li><a data-bind="text: $data.name, routeHref: { name: 'forum', params: { forumId: $data.id } }">\
</li></ul>\
<!-- ko routeView: true --><!-- /ko -->'
}

var forum = {
  path: ':forumId',
  resolve: {
    forum: function(resolutions, transition) {
      var forum = resolutions.forums.find(f => f.id == transition.params.forumId)
      if (!forum) {
        // 404
        return transition.redirectTo('forums')
      } else {
        // Always return a promise
        return Promise.resolve(forum)
      }
    },
    threads: (_, t) => http.get(`/forums/${t.params.forumId}/threads`).then(r => r.data)
  }
  template: '<section class="forum"><h2 data-bind="text: forum.title"></h2></section>',
  viewModel: function(resolutions, route, element) {
    this.forum = resolutions.forum
    this.forums = resolutions.forums
    this.threads = resolutions.threads
  }
}

route('forums', forums, function() {
  route('forum', forum)
})
```

When `/forums/1` is navigated too, the resolutions for the parent route, resolutions for `forums` will be resolved, in this case it will make an ajax call (the example uses [axios](https://github.com/mzabriskie/axios)) and the results of it, in this case a list of all the forums, will be set as the `forums` property on the resolutions object.

After the forums view model is instantiated and bindings applied, the `routeView` binding it has applies, which will resolve the `forum` route view model, calling both the `threads` and `forum` functions simultaneously. Then both those and the parent `forums` resolution is available to the child view model.

### Two-way binding of Query Parameters

Keeping all your view state in the query parameter allows users to always refresh the page and get back right where they are at, and share links to other people to see exactly what they are seeing. cherrytree-for-knockout will let you bind to query string parameters easily to support this by giving you an observable that reflects the query string, including defaults.

```javascript
var inbox = {
  path: 'inbox',
  query: {
    sort: 'desc'
  },
  viewModel: function(params, route, element) {
    this.toggleSort = () => params.sort(params.sort() === 'asc' ? 'desc' : 'asc')
  }
  template: '<div class="inbox">\
      <a class="sort" data-bind="click: $route.$root.toggleSort, text: $route.queryParams.sort"></a>\
    </div>'
}
```

When `a.sort` is clicked, the URL becomes `/inbox?sort=desc`. When clicked again, it becomes `/inbox` as sort gets set back to it's default.
