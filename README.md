## CherryTree for Knockout

### Component-based hiearchial routing for [Knockout](http://knockoutjs.com) via the [CherryTree](https://github.com/QubitProducts/cherrytree) router

[![Build Status](https://secure.travis-ci.org/nathanboktae/cherrytree-for-knockout.png?branch=master)](https://travis-ci.org/nathanboktae/cherrytree-for-knockout)

[![SauceLabs Test Status](https://saucelabs.com/browser-matrix/Cherrytree-ko.svg)](https://saucelabs.com/u/Cherrytree-ko)

### Overview

As you design your webapp, you will begin to identify workflows and pages in a heirachial fashion. Given the familiar forum domain, you will have a list of forums, then a list of thread in a specific form, then posts in that forum. You may also have an account page which has a private messages section. Each section will have it's own view and logic, and may need data loaded before it can be reached.

cherrytree-for-knockout helps you with all that legwork. You associate components with routes that will load and display where you want in the page (you define that, and anything outside the component for the route, like a breadcrumb bar, account dropdown that is on every page, etc is fully in your control). You can even specify data you need (any function that returns a promise) that will be provided to your component before initializes.

cherrytree-for-knockout is extremely lightweight in the microlib spirit at < 200 lines of code. It has one job and does it well.

### Example

Specify your components when you map your routes like so:

```javascript
var login = {
  viewModel: function() {
    this.username = ko.observable()
    // ....
  },
  template: '<form class="login"><input name="username" data-bind="value: username></input> .... </form>'
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

```
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

