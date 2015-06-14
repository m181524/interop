/**
 * Service to build 3D scenes representing missions.
 * The built scene can be accessed via public fields of the service. When the
 * scene is rebuilt it will broadcast an 'MissionScene.sceneUpdated' event.
 *
 * The world reference frame has the `home_pos` of the `MissionConfig` at
 * the origin. The `x` axis represents longitude direction, with units of
 * feet from the `home_pos`. The `y` axis represents the latitude direction,
 * with units of feet form the `home_pos`. The `z` axis represents altitude in
 * feet MSL.
 */


/**
 * Service to build 3D scenes representing missions.
 * @param $rootScope The root scope service.
 * @param Distance The distance service.
 * @param Units The units service.
 */
MissionScene = function($rootScope, Distance, Units) {
    /**
     * The root scope service.
     */
    this.rootScope_ = $rootScope;

    /**
     * The distance service.
     */
    this.distance_ = Distance;

    /**
     * The units service.
     */
    this.units_ = Units;

    /**
     * The scene that is built by the service.
     */
    this.scene = null;

    /**
     * The light in the scene.
     */
    this.skyLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.4);
    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.6);
    this.sunLight.position.set(0, 0, 1000);
    this.sunLight.castShadow = true;
    this.sunLight.shadowCameraFar = 10000;
    this.sunLight.shadowCameraLeft = -5000;
    this.sunLight.shadowCameraRight = 5000;
    this.sunLight.shadowCameraTop = 5000;
    this.sunLight.shadowCameraBottom = -5000;
    this.sunLight.shadowMapWidth = 10000;
    this.sunLight.shadowMapHeight = 10000;
    this.sunLight.shadowDarkness = 0.5;
    this.sunLight.shadowCameraVisible = true;

    /**
     * The ground plane.
     */
    this.groundTexture_ = THREE.ImageUtils.loadTexture(
            '/static/auvsi_suas/components/mission-scene-service/img/ground.jpg');
    this.groundTexture_.wrapS = THREE.RepeatWrapping;
    this.groundTexture_.wrapT = THREE.RepeatWrapping;
    this.groundTexture_.magFilter = THREE.LinearFilter;
    this.groundTexture_.minFilter = THREE.LinearFilter;
    this.groundTexture_.repeat.set(1000, 1000);
    this.groundMaterial_ = new THREE.MeshPhongMaterial({color: 0x526f35, specular: 0xffffff, shininess: 0, map: this.groundTexture_});
    this.groundGeometry_ = new THREE.PlaneBufferGeometry(1, 1);
    this.ground = new THREE.Mesh(this.groundGeometry_, this.groundMaterial_);
    this.ground.scale.set(100000, 100000, 100000);
    this.ground.receiveShadow = true;

    /**
     * The mission component geometries and materials.
     */
    this.missionComponentRadius_ = 20;
    this.missionComponentGeometry_ = new THREE.SphereGeometry(1, 32, 32);
    this.missionComponentMaterial_ = new THREE.MeshPhongMaterial({color: 0xffffff});
    this.homePosGeometry_ = this.missionComponentGeometry_;
    this.homePosMaterial_ = new THREE.MeshPhongMaterial({color: 0x00ff00});
    this.searchGridPtGeometry_ = this.missionComponentGeometry_;
    this.searchGridPtMaterial_ = new THREE.MeshPhongMaterial({color: 0x00ffff});
    this.searchGridPtRadius_ = this.missionComponentRadius_;
    this.searchGridPtLineMaterial_ = new THREE.LineDashedMaterial(
            {color: 0x00ffff});
    this.missionWaypointGeometry_ = this.missionComponentGeometry_;
    this.missionWaypointMaterial_ = new THREE.MeshPhongMaterial(
            {color: 0x0000ff, opacity: 0.7, transparent: true});
    this.missionWaypointLineMaterial_ = new THREE.LineDashedMaterial(
            {color: 0x0000ff});

    /**
     * The obstacle geometries and materials.
     */
    this.stationaryObstacleGeometry_ = new THREE.CylinderGeometry(1, 1, 1, 32);
    this.stationaryObstacleMaterial_ = new THREE.MeshPhongMaterial(
            {color: 0xff0000, opacity: 0.7, transparent: true});
    this.movingObstacleGeometry_ = this.missionComponentGeometry_;
    this.movingObstacleMaterial_ = this.stationaryObstacleMaterial_;

    /**
     * The telemetry geometries and materials.
     */
    this.telemetryGeometry_ = this.missionComponentGeometry_;
    this.telemetryRadius_ = 20;
    this.telemetryMaterial_ = new THREE.MeshPhongMaterial(
            {color: 0xffff00});
};


/**
 * Rebuild the scene with the given mission data.
 * @param mission The mission configuration.
 * @param obstacles The obstacles data.  * @param telemetry The UAS telemetry data.
 */
MissionScene.prototype.rebuildScene = function(mission, obstacles, telemetry) {
    // Create fresh scene for rebuild.
    var scene = new THREE.Scene();

    // Add the ground plane.
    scene.add(this.ground);

    // Add the light.
    scene.add(this.skyLight);
    scene.add(this.sunLight);

    // Build mission scene components. Requires a mission and home position.
    if (!!mission && !!mission.home_pos) {
        this.addMissionSceneElements_(mission, scene);
        this.addObstacleSceneElements_(
                mission, obstacles, mission.home_pos, scene);
        this.addTelemetrySceneElements_(
                mission, telemetry, mission.home_pos, scene);
    }

    // Update the scene and notify others.
    this.scene = scene;
    this.rootScope_.$broadcast('MissionScene.sceneUpdated');
};


/**
 * Adds the mission elements to the scene.
 * @param mission The mission components to add.
 * @param scene The scene to add elements to.
 */
MissionScene.prototype.addMissionSceneElements_ = function(mission, scene) {
    // Add home position.
    var homePos = this.createObject_(
            this.homePosGeometry_, this.homePosMaterial_,
            mission.home_pos, this.missionComponentRadius_, mission.home_pos,
            this.missionComponentRadius_, scene);

    // Add mission components to scene.
    var missionComponents = [
        mission.air_drop_pos, mission.emergent_last_known_pos,
        mission.ir_primary_target_pos, mission.ir_secondary_target_pos,
        mission.off_axis_target_pos, mission.sric_pos];
    for (var i = 0; i < missionComponents.length; i++) {
        var component = missionComponents[i];
        var componentObj = this.createObject_(
                this.missionComponentGeometry_, this.missionComponentMaterial_,
                component, this.missionComponentRadius_, mission.home_pos,
                this.missionComponentRadius_, scene);
    }

    // Add search grid points.
    for (var i = 0; i < mission.search_grid_points.length; i++) {
        var searchPt = mission.search_grid_points[i];
        var searchPtObj = this.createObject_(
                this.searchGridPtGeometry_, this.searchGridPtMaterial_,
                searchPt, this.searchGridPtRadius_, mission.home_pos,
                this.searchGridPtRadius_, scene);
    }

    // Add lines between search grid points.
    var searchGridPtLineGeometry = new THREE.Geometry();
    for (var i = 0; i < mission.search_grid_points.length; i++) {
        var j = (i + 1) % mission.search_grid_points.length;
        var start = mission.search_grid_points[i];
        var end = mission.search_grid_points[j];

        var startPt = new THREE.Vector3();
        this.setObjectPosition_(
                start, this.searchGridPtRadius_, mission.home_pos, startPt);
        var endPt = new THREE.Vector3();
        this.setObjectPosition_(
                end, this.searchGridPtRadius_, mission.home_pos, endPt);

        searchGridPtLineGeometry.vertices.push(startPt, endPt);
    }
    var searchGridPtLine= new THREE.Line(
            searchGridPtLineGeometry, this.searchGridPtLineMaterial_);
    scene.add(searchGridPtLine);


    // Add mission waypoints.
    for (var i = 0; i < mission.mission_waypoints.length; i++) {
        var waypoint = mission.mission_waypoints[i];
        var waypointObj = this.createObject_(
                this.missionWaypointGeometry_, this.missionWaypointMaterial_,
                waypoint, waypoint.altitude_msl, mission.home_pos,
                mission.mission_waypoints_dist_max, scene);
    }

    // Add lines between mission waypoints.
    var missionWaypointLineGeometry = new THREE.Geometry();
    for (var i = 0; i < mission.mission_waypoints.length - 1; i++) {
        var start = mission.mission_waypoints[i];
        var end = mission.mission_waypoints[i+1];

        var startPt = new THREE.Vector3();
        this.setObjectPosition_(
                start, start.altitude_msl, mission.home_pos, startPt);
        var endPt = new THREE.Vector3();
        this.setObjectPosition_(
                end, end.altitude_msl, mission.home_pos, endPt);

        missionWaypointLineGeometry.vertices.push(startPt, endPt);
    }
    var missionWaypointLine = new THREE.Line(
            missionWaypointLineGeometry, this.missionWaypointLineMaterial_);
    scene.add(missionWaypointLine);
};


/**
 * Adds the obstacle elements to the scene.
 * @param mission The mission components to add.
 * @param obstacles The obstacles to add.
 * @param refPos A reference GPS position to convert GPS to reference frame.
 * @param scene The scene to add elements to.
 */
MissionScene.prototype.addObstacleSceneElements_ = function(
        mission, obstacles, refPos, scene) {
    for (var i = 0; i < obstacles.stationary_obstacles.length; i++) {
        var obstacle = obstacles.stationary_obstacles[i];
        var obstacleObj = this.createObject_(
                this.stationaryObstacleGeometry_, this.stationaryObstacleMaterial_,
                obstacle, obstacle.cylinder_height/2, mission.home_pos,
                1, scene);
        obstacleObj.scale.set(
                obstacle.cylinder_radius, obstacle.cylinder_height,
                obstacle.cylinder_radius);
        obstacleObj.rotation.set(Math.PI/2, 0, 0);
    }

    for (var i = 0; i < obstacles.moving_obstacles.length; i++) {
        var obstacle = obstacles.moving_obstacles[i];
        var obstacleObj = this.createObject_(
                this.movingObstacleGeometry_, this.movingObstacleMaterial_,
                obstacle, obstacle.altitude_msl, mission.home_pos,
                obstacle.sphere_radius, scene);
    }
};


/**
 * Adds the telemetry elements to the scene.
 * @param mission The mission components to add.
 * @param telemetry The telemetry to add.
 * @param refPos A reference GPS position to convert GPS to reference frame.
 * @param scene The scene to add elements to.
 */
MissionScene.prototype.addTelemetrySceneElements_ = function(
        mission, telemetry, refPos, scene) {
    for (var i = 0; i < telemetry.length; i++) {
        var userTelem = telemetry[i];
        var userTelemObj = this.createObject_(
                this.telemetryGeometry_, this.telemetryMaterial_,
                userTelem, userTelem.altitude_msl, mission.home_pos,
                this.telemetryRadius_, scene);
    }
};


/**
 * Sets the position of the object to the given GPS position.
 * @param pos The gps position with latitude and longitude fields.
 * @param alt The altitude in feet.
 * @param refPos The reference GPS position to convert GPS to reference frame.
 * @param objPos The object position with x,y fields.
 */
MissionScene.prototype.setObjectPosition_ = function(pos, alt, refPos, objPos) {
    // Compute distance components in lat/lon axis.
    var distX = this.distance_.haversine(refPos.latitude, pos.longitude, refPos.latitude, refPos.longitude);
    var distY = this.distance_.haversine(pos.latitude, refPos.longitude, refPos.latitude, refPos.longitude);
    // Set the position.
    objPos.x = Math.sign(pos.longitude - refPos.longitude) * distX;
    objPos.y = Math.sign(pos.latitude- refPos.latitude) * distY;
    objPos.z = alt;
};


/**
 * Creates a scene object with standard properties.
 * @param geometry The geometry to use.
 * @param material The material to use.
 * @param pos The position to use.
 * @param alt The latitude to use.
 * @param refPos The reference position for reference frame.
 * @param scale The object scale.
 * @param scene The scene to add the object to.
 * @return The object that was created and added to the scene.
 */
MissionScene.prototype.createObject_ = function(
        geometry, material, pos, alt ,refPos, scale, scene) {
    var obj = new THREE.Mesh(geometry, material);
    this.setObjectPosition_(pos, alt, refPos, obj.position);
    obj.scale.set(scale, scale, scale);
    obj.castShadow = true;
    obj.receiveShadow = true;
    scene.add(obj);
    return obj
}


// Register the service.
angular.module('auvsiSuasApp').service('MissionScene', [
    '$rootScope',
    'Distance',
    'Units',
    MissionScene
]);