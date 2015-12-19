## CherryTree for Knockout

### Component-based hiearchial routing for [Knockout](http://knockoutjs.com) via the [CherryTree](https://github.com/QubitProducts/cherrytree) router

[![Build Status](https://secure.travis-ci.org/nathanboktae/cherrytree-for-knockout.png?branch=master)](https://travis-ci.org/nathanboktae/cherrytree-for-knockout)

[![SauceLabs Test Status](https://saucelabs.com/browser-matrix/Cherrytree-ko.svg)](https://saucelabs.com/u/Cherrytree-ko)

### Overview

As you design your webapp, you will begin to identify workflows and pages in a heirachial fashion. Given the familiar forum domain, you will have a list of forums, then a list of thread in a specific form, then posts in that forum. You may also have an account page which has a private messages section. Each section will have it's own view and logic, and may need data loaded before it can be reached.

cherrytree-for-knockout helps you with all that legwork. You associate components with routes that will load and display where you want in the page (you define that, and anything outside the component for the route, like a breadcrumb bar, account dropdown that is on every page, etc is fully in your control). You can even specify data you need (any function that returns a promise) that will be provided to your component before initializes.

cherrytree-for-knockout is extremely lightweight in the microlib spirit at < 300 lines of code. It has one job and does it well.

### Example

Specify your components when you map your routes like so:

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

Notice that you do not have to explicitly register the component via `ko.components.register` - cherrytree-for-knockout will do that for you.

Now for the HTML:

```html
<body>
  <header>
    <ul data-bind="foreach: route.state && route.state.routes">
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

Notice the `routeView` binding. This is where a component for a route will be rendered. In the top level `routeView` binding, you must provide the router instance. This will be available on the root view model as `router`. For nested `routeView`s, the parameter is currently ignored so `true` or `{}` will suffice.

Above `main` there is a header which creates bindings based on the current route state. cherrytree-for-knockout will back the `state` property behind an observable, so when the current route changes, depedencies will update, so we can have a simple breadcrumb in this example. `routeHref` is a binding handler that will set the `href` for the route you specify via `router.generate`

Below that is a signout button with a click handler, showing that cherrytree-for-knockout plugs into your existing app how you wish, and ultimately your are still in control of your application's layout and workflow.

As you work with your route components, you'll often want to refer to it in your view, which in simple cases using `$component` will meet your needs. However, as you begin to use more components nested within eachother, using `$parents` is cumbersome and fragile, `$routeComponent` is available and exposed to work as your replacement for `$root` in a traditional one uber view-model structure.

However `$routeComponent` is not supported with asyncrounous components. In general I recommend always declaring your components as syncrounous, as `bindingContext` was designed for the syncrounous binding world, and for symettry with standard bindings that always work syncronously.

### Two-way binding of Query Parameters

Keeping all your view state in the query parameter allows users to always refresh the page and get back right where they are at, and share links to other people to see exactly what they are seeing. cherrytree-for-knockout will let you bind to query string parameters easily to support this by giving you an observable that reflects the query string, including defaults.

```javascript
var inbox = {
  path: 'inbox',
  query: {
    sort: 'desc'
  },
  viewModel: function(params) {
    this.sort = params.sort
    this.toggleSort = () => params.sort(params.sort() === 'asc' ? 'desc' : 'asc')
  }
  template: '<div class="inbox">\
      <a class="sort" data-bind="click: toggleSort, text: sort"></a>\
    </div>'
}
```

When `a.sort` is clicked, the URL becomes `/inbox?sort=desc`. When clicked again, it becomes `/inbox` as sort gets set back to it's default.
