angular.module('wpApp.controllers', [])

.controller('AppCtrl', function($scope, $rootScope, $localstorage ) {

  // Controller for main view, anything global should go here
  
  $rootScope.increment = function() {
    var i = $localstorage.get('increment');
    if(!i) {
      $localstorage.set('increment', 1);
      return 1;
    } else {
      i++;
      $localstorage.set('increment', i );
      return i;
    }
  }
  
  $rootScope.callback = '_jsonp=JSON_CALLBACK';

})

.controller('SitesCtrl', function( $scope, $http, DataLoader, $timeout, $rootScope, $ionicModal, $localstorage, $ionicLoading, CacheFactory ) {

  // Sites view: templates/sites.html

  $scope.sites = [];

  // Create a cache for our site information
  if (!CacheFactory.get('siteCache')) {
    CacheFactory.createCache('siteCache');
  }

  $rootScope.siteCache = CacheFactory.get('siteCache');

  if( $rootScope.siteCache ) {
    // Loop through storage and add to our sites
    angular.forEach( $rootScope.siteCache.keys(), function( value, key ) {
      $scope.sites.push( $rootScope.siteCache.get(value) );
    });
  }

  // Add a site modal
  $ionicModal.fromTemplateUrl('templates/add-site-modal.html', {
    scope: $scope
  }).then(function(sitemodal) {
    $scope.sitemodal = sitemodal;
  });

  $scope.stripTrailingSlash = function(str) {
    if(str.substr(-1) == '/') {
        return str.substr(0, str.length - 1);
    }
    return str;
  }
  
  $scope.createSite = function(u) { 

    // Called when "create site" button is pressed

    if(!u) {
      alert('Please fill in all fields.');
      return;
    }

    $ionicLoading.show({
      noBackdrop: true
    });

    var siteURL = $scope.stripTrailingSlash( u.url );

    var siteApi = siteURL + '/wp-json/' + '?' + $rootScope.callback;

    DataLoader.get( siteApi ).then(function(response) {

        var siteID = $rootScope.increment();
        var site = { id: siteID, title: response.data.name, description: response.data.description, url: siteURL, username: u.username, password: u.password };
        $scope.sites.push( site );

        // Add site to cache
        $rootScope.siteCache.put( siteID, site );

        $ionicLoading.hide();
      }, function(response) {
        $ionicLoading.hide();
        alert('Please make sure the WP-API plugin is installed on your site.');
        console.log('Site Factory error');
    });

    $scope.sitemodal.hide();

    $scope.message = '';
    
  };


  if( $rootScope.siteCache.keys().length >= 1 ) {
    $scope.message = '';
  } else {
    $scope.message = 'Click + to add a site.';
  }

  $scope.onItemDelete = function(item) {

    // console.log('Deleting site: ' + item.id);

    $scope.sites.splice($scope.sites.indexOf(item), 1);

    $rootScope.siteCache.remove(item.id);

    angular.forEach( window.localStorage, function( value, key ) {

      // find and delete all site[id] caches (pages,posts,comments,etc)
     var sub = key.substring(20, 25);
     
     if( sub == 'site' + item.id ) {
       window.localStorage.removeItem(key);
     }
    });
  }

})

.controller('SiteCtrl', function($scope, $stateParams, $ionicLoading, $localstorage, $rootScope, DataLoader, $state ) {

  // Controller for single site detail page. templates/site.html

  // Site ID
  $scope.id = $stateParams.siteId;

  var site = $rootScope.siteCache.get($scope.id);

  // Example data
  $scope.content = '<img src="img/male-circle-512.png" class="site-avatar" /><h2 class="padding">' + site.title + '</h2>';

  var url = site.url;

  // Default sections, can be passed in from somewhere else
  $scope.sitesections = [{'title': { 'rendered': 'Comments' }, 'icon':'ion-ios-chatbubble-outline', 'route':'/wp/v2/comments/' }, {'title': { 'rendered': 'Posts' }, 'icon':'ion-ios-browsers-outline', 'route':'/wp/v2/posts/' },{'title': { 'rendered': 'Pages' }, 'icon':'ion-ios-paper-outline', 'route':'/wp/v2/pages/'},{'title': { 'rendered': 'Media' }, 'route':'/wp/v2/media/', 'icon':'ion-ios-cloud-outline'}];

  var dataURL = url + '/wp-json/wp-app/v1/app/?' + $rootScope.callback;

  // Example of adding a section
  DataLoader.get( dataURL ).then(function(response) {
        // console.log( response.data );
        $scope.sitesections.push({ 'title': { 'rendered': response.data.title.rendered }, 'icon': response.data.icon, 'route': response.data.route });
        $ionicLoading.hide();
      }, function(response) {
        $ionicLoading.hide();
        console.log('No custom site sections to get.');
    });

  // Gets the API route from the link in site.html, which we use in SiteSectionCtrl
  $scope.apiRoute = function(route) {
    $rootScope.route = route;
  }

})

.controller('SiteSectionCtrl', function($scope, $stateParams, DataLoader, $ionicLoading, $rootScope, $localstorage, $timeout ) {

  // Individual site data (posts, comments, pages, etc). templates/site-section.html. Should be broken into different controllers and templates for more fine-grained control

  // Get slug such as 'comments' from our route, to use to fetch data
  if($rootScope.route) {
    var slug = $rootScope.route.split('/');
    var slugindex = $rootScope.route.split('/').length - 2;
    $scope.slug = slug[slugindex];
  }

  $scope.id = $stateParams.siteId;

  var dataURL = $rootScope.siteCache.get($scope.id).url + '/wp-json' + $rootScope.route;

  // Gets API data
  $scope.loadData = function() {

    // $ionicLoading.show({
    //   noBackdrop: true
    // });

    DataLoader.get( dataURL + '?' + $rootScope.callback ).then(function(response) {

        $scope.data = response.data;
        $ionicLoading.hide();

      }, function(response) {

        console.log('Error');
        $ionicLoading.hide();

    });

  }

  // Load posts on page load
  $scope.loadData();

  paged = 2;
  $scope.moreItems = true;

  // Load more (infinite scroll)
  $scope.loadMore = function() {

    if( !$scope.moreItems ) {
      return;
    }

    var pg = paged++;

    console.log('loading more...' + pg );

    $timeout(function() {

      DataLoader.get( dataURL + '?page=' + pg + '&' + $rootScope.callback ).then(function(response) {

        // Prevent load more bug
        if( response.data.length <= 0 || response.data[0].id === $scope.data[0].id || response.data[0].content === $scope.data[0].content ) {
          $scope.moreItems = false;
          return;
        }

        angular.forEach( response.data, function( value, key ) {
          $scope.data.push(value);
        });

      }, function(response) {
        $scope.moreItems = false;
        console.log('Load more error');
      });

      $scope.$broadcast('scroll.infiniteScrollComplete');
      $scope.$broadcast('scroll.resize');

    }, 1000);

  }

  $scope.moreDataExists = function() {
    return $scope.moreItems;
  }

  // Pull to refresh
  $scope.doRefresh = function() {
  
    console.log('Refreshing!');

    $timeout( function() {

      $scope.loadData();

      //Stop the ion-refresher from spinning
      $scope.$broadcast('scroll.refreshComplete');
    
    }, 1000);
      
  }

})

.controller('SiteSettingsCtrl', function($scope, $stateParams, DataLoader, $ionicLoading, $rootScope ) {

  // Individual site settings, settings.html
  $scope.settings = {};
  $scope.site = $rootScope.siteCache.get($stateParams.siteId);
  console.log($scope.site);
  $scope.siteTitle = $scope.site.title;
  $scope.settings.url = $scope.site.url;
  $scope.settings.username = $scope.site.username;
  $scope.settings.password = $scope.site.password;

  //$scope.$on( '$ionicView.leave', $scope.saveSettings );

  $scope.saveSettings = function() {
    //console.log($scope.settings);
    $scope.site.url = $scope.settings.url;
    $scope.site.username = $scope.settings.username;
    $scope.site.password = $scope.settings.password;
    // $scope.site.push( url );
    //console.log($scope.site);
    $rootScope.siteCache.put( $stateParams.siteId, $scope.site );
    alert('Saved!');
  }

})

.controller('SiteSectionDetailCtrl', function($scope, $stateParams, DataLoader, $ionicLoading, $rootScope, $localstorage, CacheFactory, $sce, $timeout ) {

  // Item detail view (single post, comment, etc.) templates/site-section-details.html

  $rootScope.siteCache = CacheFactory.get('siteCache');

  $scope.siteID = $stateParams.siteId;
  $scope.slug = $stateParams.slug;
  $scope.itemID = $stateParams.itemId;
  $scope.site = $rootScope.siteCache.get($scope.siteID);
  var url = $scope.site.url;

  if (!CacheFactory.get( 'site' + $scope.siteID + $scope.slug )) {
    // Create cache
    CacheFactory.createCache( 'site' + $scope.siteID + $scope.slug );
  }

  // Our data cache, i.e. site1postscache
  var dataCache = CacheFactory.get( 'site' + $scope.siteID + $scope.slug );

  // API url to fetch data
  var dataURL = url + '/wp-json' + $rootScope.route + $scope.itemID;

  // Handle charts
  $scope.loadChart = function(data) {

    if(!data)
      return;

    $timeout( function() {

      var ctx = document.getElementById("myChart").getContext("2d");
      var myNewChart = new Chart(ctx).Line( data );
    
    }, 1000);

  }

  if( !dataCache.get($scope.itemID) ) {

    $ionicLoading.show({
      noBackdrop: true
    });

    // Item doesn't exists, so go get it
    DataLoader.get( dataURL + '?' + $rootScope.callback ).then(function(response) {
        console.log(response.data);
        $scope.siteData = response.data;
        $scope.content = $sce.trustAsHtml(response.data.content.rendered);
        dataCache.put( response.data.id, response.data );

        if(response.data.chart) {
          $scope.loadChart(response.data.chart);
        }

        $ionicLoading.hide();
        // console.dir(response.data);
      }, function(response) {
        console.log('Error');
        $ionicLoading.hide();
    });

  } else {
    // Item exists, use localStorage
    $scope.siteData = dataCache.get( $scope.itemID );
    $scope.content = $sce.trustAsHtml( $scope.siteData.content.rendered );
    
    if($scope.siteData.chart) {
      $scope.loadChart( $scope.siteData.chart );
    }
  }

  // Not working yet
  $scope.deleteComment = function() {
    // Not working, possible CORS error?
    var itemURL = $scope.site.url + '/wp-json/wp/v2/' + $scope.slug + '/' + $scope.siteData.id;

    console.log(itemURL);

    DataLoader.delete( $scope.site.username, $scope.site.password, itemURL ).then(function(response) {
      console.dir(response.data);
    }, function(response) {
      console.log('Error: ' + response.data );
  });
  }

})

.controller('StatsCtrl', function($scope ) {

  // var ctx = document.getElementById("line").getContext("2d");
  // var myNewChart = new Chart(ctx).Line(data, options);

  // This is our data for stats.html

  $scope.labels = ["January", "February", "March", "April", "May", "June", "July"];
  $scope.series = ['2014', '2015'];
  $scope.data = [
      [65, 59, 80, 81, 56, 55, 40],
      [28, 48, 40, 19, 86, 27, 90]
  ];
})

.controller('IntroCtrl', function($scope, $state, $ionicSlideBoxDelegate, $ionicViewService) {

  // Might use this intro for final app

  $ionicViewService.nextViewOptions({
    disableBack: true
  });
 
  // Called to navigate to the main app
  $scope.startApp = function() {
    $state.go('app.posts');
  };
  $scope.next = function() {
    $ionicSlideBoxDelegate.next();
  };
  $scope.previous = function() {
    $ionicSlideBoxDelegate.previous();
  };

  // Called each time the slide changes
  $scope.slideChanged = function(index) {
    $scope.slideIndex = index;
  };

});