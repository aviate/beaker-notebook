!(function(app) {
  app.controller('authentication', [
    '$rootScope',
    '$scope',
    '$state',
    'Restangular',
    'UsersRestangular',
    '$http',
    '$sessionStorage',
    '$stateParams',
    'Factories',
    'TrackingService',
    function(
      $rootScope,
      $scope,
      $state,
      Restangular,
      UsersRestangular,
      $http,
      $sessionStorage,
      $stateParams,
      F,
      TrackingService) {

    $scope.message = ''
    $scope.user = $scope.user || {};

    function signIn() {
      return F.Users.getCurrentUser().then(function(d) {
        $sessionStorage.user = _.pick(d, 'name', 'public-id', 'role');
        $sessionStorage.user.id = d['public-id'];
        $scope.message = 'You are signed in.'
        $scope.loading = false;
        if ($rootScope.goTo) {
          $state.go($rootScope.goTo);
          delete $rootScope.goTo;
        } else {
          $state.go('projects.items');
        }
      })
    }

    $scope.showPasswordValidationErrorMessage  = function(form) {
      return form.password.$invalid && !form.password.$pristine
    };

    function createDefaultProject() {
      F.Projects.create({name: 'Sandbox', description: 'Sandbox'});
    }

    $scope.submit = function() {
      TrackingService.mark('SignIn');
      $scope.loading = true;
      UsersRestangular.all('sessions').post($scope.user)
        .then(signIn)
        .catch(function(err) {
          $scope.loading = false;
          $scope.message = 'Error: Invalid user or password';
        });
    };

    $scope.signUp = function (isValid) {
      TrackingService.mark('SignUp');
      if(isValid) {
        $scope.loading = true;
        UsersRestangular.all('users').post($scope.user)
          .then(signIn)
          .then(createDefaultProject)
          .catch(function(err) {
            $scope.loading = false;
            if(err.status === 409) {
              $scope.message = 'Error: Email is already registered';
            } else {
              $scope.message = 'Error: Invalid user or password';
            }
          });
        } else {
          $scope.message = 'Error: Please fill in form completely'
        }

    };

    $scope.sendEmail = function () {
      Restangular.all('forgot_password').post($scope.user)
        .then(function() {
          $scope.message = 'An email with further instruction has been sent';
        })
        .catch(function(err) {
          $scope.message = "Error: " + err.data;
        })
    };

    $scope.submitPassword = function(isValid) {
      if (isValid) {
        $scope.user.requestId = $stateParams.id
        Restangular.all('change_password').post($scope.user)
          .then(function() {
            $scope.message = 'Your password has been updated'
          })
          .catch(function(err) {
            $scope.message = "Error: " + err.data;
          })
      } else {
        $scope.message = "Error: The entered password is too short"
      }
    };
  }]);
})(window.bunsen);