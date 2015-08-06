describe('CherryTree for Knockout', function() {
  it('should render a blank component when no route is active')
  it('should automatically register a component and render it')
  it('should not register components already registered') // should we prefix registered components?
  it('should render nested components')
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