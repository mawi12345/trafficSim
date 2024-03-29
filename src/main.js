/**

TODO: add path finding

 */

$(function(){
	
	var gui = require('nw.gui');
	gui.Window.get().showDevTools();
	
	var ns = {};
	
	Backbone.Relational.store.addModelScope(ns);
	
	var Vertex = ns.Vertex = Backbone.RelationalModel.extend({
		
		getId: function() {
			return this.get('id');
		},
		
		getX: function() {
			return this.get('x');
		},
		
		getY: function() {
			return this.get('y');
		}
	});
	
	var VertexCollection = ns.VertexCollection = Backbone.Collection.extend({
		  		
		model: Vertex
		
	});
	
	var Edge = ns.Edge = Backbone.RelationalModel.extend({
		
		getId: function() {
			return this.get('id');
		},
		
		targetStepLength: 20,
		
		relations: [
    		{
    			type: Backbone.HasOne,
    			key: 'v1',
    			relatedModel: 'Vertex',
    			collectionType: 'VertexCollection',
    			includeInJSON: 'id',
    			reverseRelation: {
    				key: 'startingEdges'
    			}
    		}, {
    			type: Backbone.HasOne,
    			key: 'v2',
    			relatedModel: Vertex,
    			collectionType: VertexCollection,
    			includeInJSON: 'id',
    			reverseRelation: {
    				key: 'endingEdges'
    			}
    		}
		],
		
		getSteps: function() {
			return Math.round(this.getLength() / this.targetStepLength);
		},
		
		getStepRotation: function(step) {
			if (step < 0 || step > this.getSteps()) throw new Error('step '+step+' is not valid');
			//constant
			return Math.atan2(this.get('v2').getY()-this.get('v1').getY(), this.get('v2').getX()-this.get('v1').getX());
		},
		
		getSpeedLimit: function() {
			var limit = this.get('sl');
			if (!limit) return 1e+100;
			return limit;
		},
		
		getStepLength: function() {
			return this.getLength() / this.getSteps();
		},
		
		getStepPosition: function(step) {
			if (step < 0 || step > this.getSteps()) throw new Error('step '+step+' is not valid');
			var p = {x: 0, y:0};
			if (step == 0) {
				p = {
					x: this.get('v1').getX(),
					y: this.get('v1').getY()
				};
			} else if (step == this.getStepLength()) {
				p = {
					x: this.get('v2').getX(),
					y: this.get('v2').getY()
				};
			} else {
				p = {
					x: this.get('v1').getX() + ((this.get('v2').getX()-this.get('v1').getX())*(step/this.getSteps())),
					y: this.get('v1').getY() + ((this.get('v2').getY()-this.get('v1').getY())*(step/this.getSteps()))
				};
			}
			//console.log('position ', p, step);
			return p;
			
		},
		
		getLength: function() {
			var x = Math.abs(this.get('v1').getX()-this.get('v2').getX());
			var y = Math.abs(this.get('v1').getY()-this.get('v2').getY());
			return Math.sqrt(Math.pow(x, 2)+Math.pow(y, 2));
		},
		
		getPriority: function() {
			var priority = this.get('p');
			if (!priority) return 0;
			return priority;
		}
	
	});
	
	var EdgeCollection = ns.EdgeCollection = Backbone.Collection.extend({
  		
		model: Edge
		
	});
	
	var Obstacle = ns.Obstacle = Backbone.RelationalModel.extend({
		
		subModelTypes: {
			'static': 'StaticObstacle',
			'car': 'Car'
		},
		
		relations: [
    		{
    			type: Backbone.HasOne,
    			key: 'edge',
    			relatedModel: Edge,
    			collectionType: EdgeCollection,
    			includeInJSON: 'id',
        		reverseRelation: {
        			key: 'cars'
        		}
    		}
		],
				
		random: 0,
		
		getId: function() {
			return this.get('id');
		},
		
		getX: function() {
			return this.get('x');
		},
		
		getY: function() {
			return this.get('y');
		},
		
		rendomize: function() {
			this.random = Math.random();
		},
		
		getGateways: function() {
			return [];
		},
		
		move: function() {
			console.log('overwrite this method!');
		},
		
		getPosition: function() {
			return this.get('p');
		},
		
		getSpeed: function() {
			return this.get('s');
		},
		
		setSpeed: function(speed) {
			if (speed < 0) speed = 0;
			this.set({'s': speed});
		},
		
		initialize: function() {
			this.resetPriority();
		},
		
		addPriority: function(vertex) {
			this.priorityVertexIds.push(vertex.getId());
		},
		
		hasPriority: function(vertex) {
			return _.contains(this.priorityVertexIds, vertex.getId());
		},
		
		resetPriority: function() {
			this.priorityVertexIds = [];
		},
		
		getDistance: function(vertex) {
			return 0;
		}
		
	});
	
	var StaticObstacle = ns.StaticObstacle = Obstacle.extend({
		
		initialize: function() {
			this.set(this.get('edge').getStepPosition(this.get('p')));
		},
		
		calculate: function() {},
		
		move: function() {},
		
	});
	
	var Car = ns.Car = Obstacle.extend({
		
		_path: [],
		
		_position: 0,
		
		// maximal speed
		maxSpeed: 8,
			
		// dawdle probability
		dawdle: 0.15,
		
		// acceleration factor 
		acceleration: 0.125,
		
		// minimal distance to obstacle 
		minDistance: 1,
		
		// ignore speed limit ahead
		brakeFactor: 0.4,
		
		step: 20,
				
		initialize: function() {
			this._path = [];
			this._path.push(this.get('edge'));
			this._position = this.get('p');
		},
		
		getPosition: function() {
			return this._position;
		},
		
		getPathLength: function() {
			var length = 0;
			_.each(this._path, function(edge){
				if (!edge) {
					console.log('car'+this.getId()+' Error in getPathLength', this._path);
				}
				length += edge.getSteps();
			}, this);
			return length;
		},
		
		/**
		 * gib ein edge anhand des letzten punkt in der kette zurück
		 */
		getNextEdge: function() {
			var lastVertex = this._path[this._path.length-1].get('v2');
			var possibilities = lastVertex.get('startingEdges');
			var r = possibilities.at(_.random(possibilities.length-1));
			window.p = possibilities;
			//console.log('choosing', r, possibilities);
			return r;
		},
		
		extendPath: function(steps) {
			while ((this.getPathLength()-this._position) <= steps) {
				this._path.push(this.getNextEdge());
			}
		},
		
		/**
		 * bilde kette in path bis die kette die länge speed hat
		 * suche in der kette nach hinternisen und 
		 * gib die länge bis zum hinderniss order speed zurück
		 * 
		 * @returns {Number}
		 */
		getMaxWay: function(overwritePriority, speed) {
			this.extendPath(speed);
						
			var distanceToEdge = 0;
			var posOnEdge = this.getPosition();
			var next = speed;
			for (var i=0; i<this._path.length; i++) {
				var edge = this._path[i];
				var cars = edge.get('cars');
				
				// check cars on edge
				cars.each(function(car){
					if (car.getId() == this.getId()) return;
					if (posOnEdge > car.getPosition()) return; // car is not in front
					var distance = distanceToEdge + (car.getPosition() - posOnEdge) - this.minDistance;
					if (distance < 0) {
						console.error('car'+this.getId()+' getMaxWay algo error1! distance: ' + distance, distanceToEdge, car.getPosition(), posOnEdge, this.minDistance);
						throw new Error('car'+this.getId()+' getMaxWay algo error1! distance: ' + distance);
					}
					if (distance < next) next = distance;
				}, this);
				
				//check the cars on starting edges
				if ((posOnEdge + speed) >= (distanceToEdge + edge.getSteps())) {
					edge.get('v2').get('startingEdges').each(function(startingEdge){
						var carsOnStaringEdge = startingEdge.get('cars');
						carsOnStaringEdge.each(function(car){
							if (car.getPosition() < this.minDistance) {
								// like an car on the end of the edge
								var distance = distanceToEdge + (edge.getSteps() - posOnEdge) - this.minDistance;
								if (distance < 0) {
									console.error('car'+this.getId()+' getMaxWay algo error2! distance: ' + distance, distanceToEdge, edge.getSteps(), posOnEdge, this.minDistance);
									throw new Error('car'+this.getId()+' getMaxWay algo error2! distance: ' + distance);  
								}
								if (distance < next) next = distance;
							}
						}, this);
					}, this);
				}
				
				distanceToEdge += edge.getSteps() - posOnEdge;
				posOnEdge = 0;
				
				if (next < speed) return next;
				
				if (!overwritePriority && !this.hasPriority(edge.get('v2'))) {
					return (distanceToEdge - this.minDistance);
				}
				
				if (distanceToEdge >= speed) return speed;
			}
			
			return speed;
		},
		
		/**
		 * setze x und y anhand der kette und der position
		 * entferne das erste glid der kette wenn die position auf dem 2ten ist.
		 * postion update!!! UND car von edge entferen und hinzufügen
		 */
		move: function() {
			var speed = this.getNextSpeed();
			this.setSpeed(speed);
			this.trigger('move', this._path.slice(), this._position, speed);
			//console.log('car '+this.getId()+' move');
			this._position += speed;
			while (this._position >= this._path[0].getSteps()) {
				//console.log('removing first');
				var edge = this._path[0];
				edge.get('cars').remove(this);
				this._position -= edge.getSteps();
				this._path.shift();
				this._path[0].get('cars').add(this);
			}
			var edge = this._path[0];
			this.set(edge.getStepPosition(this._position));
			
		},
		
		getGateways: function() {
			
			var edges = [];
			
			var speed = this.getNextSpeed(true, this.minDistance);
						
			var position = this._position + speed;
			
			// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
			// TODO: chould not be nessasery getMaxWay should find this car
			// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
			// check if car could stand still and lock all endinding edges an vertex
			/*
			if (this.getNextSpeed(true) == 0 && this._position == 0) {
				console.log('car'+this.getId()+' special locking state');
				edges = this._path[0].get('v1').get('endingEdges').toArray();
			}
			*/
			var i = 0;
			while (position >= this._path[i].getSteps()) {
				position -= this._path[i].getSteps();
				edges.push(this._path[i]);
				i++;
			}
			
			return edges;
		},
		
		getNextSpeed: function(overwritePriority, minSpeed) {
			var newSpeed = this.getSpeed();
			if (newSpeed < this.maxSpeed) {
				newSpeed += this.acceleration*this.maxSpeed;
			}
			
			if (minSpeed && minSpeed > newSpeed) newSpeed = minSpeed;
			
			var maxWay = this.getMaxWay(overwritePriority, newSpeed);
			if (newSpeed > maxWay) newSpeed = maxWay;
			if (this.random - this.dawdle < 0) {
				newSpeed -= this.acceleration*this.maxSpeed;
			}
			
			//check the speed limit
			_.each(this._path, function(edge){
				var limit;
				if (this.get('edge').getId() == edge.getId()) {
					limit = edge.getSpeedLimit();
				} else {
					var distance = this.getDistance(edge.get('v1'));
					var ignore = Math.floor(distance*this.brakeFactor/(this.acceleration*this.maxSpeed))*(this.acceleration*this.maxSpeed);
					if (ignore < 0) throw new Error('algo error ignore: '+ignore);
					limit = edge.getSpeedLimit() + ignore;
					if (ignore > 0 && limit < newSpeed)
						console.log('speed limit ahead! ignore: ' + ignore + ' limit:' + limit + ' edge.limit: ' + edge.getSpeedLimit() + ' distance: ' + distance);
				}
				if (limit < newSpeed) newSpeed = limit;
			}, this);
			
			
			if (newSpeed < 0) return 0;
			return newSpeed;
		},
		
		getDistance: function(vertex) {
			
			var distanceV2 = -this.getPosition();
			var distanceV1 = this.getPosition();
			
			for (var i=0; i<this._path.length; i++) {
				var edge = this._path[i];
				if (edge.get('v1').getId() == vertex.getId()) return Math.abs(distanceV1);
				distanceV1 -= edge.getSteps();
				distanceV2 += edge.getSteps();
				if (edge.get('v2').getId() == vertex.getId()) return distanceV2;
			}
			
			throw new Error('getDistance vertex'+vertex.getId()+' not in path');
		}
		
	});
	
	var ObstacleCollection = ns.CarCollection = Backbone.Collection.extend({
		  		
		model: Obstacle
		
	});
	
	window.vertexs = new VertexCollection([
           {id:1, x:50, y:50},
           {id:2, x:300, y:50},
           {id:3, x:320, y:50},
           {id:4, x:570, y:50},
           {id:5, x:50, y:300},
           {id:6, x:285, y:300},
           {id:7, x:300, y:285},
           {id:8, x:320, y:285},
           {id:9, x:335, y:300},
           {id:10, x:570, y:300},
           {id:11, x:50, y:320},
           {id:12, x:285, y:320},
           {id:13, x:300, y:335},
           {id:14, x:320, y:335},
           {id:15, x:335, y:320},
           {id:16, x:570, y:320},
           {id:17, x:50, y:570},
           {id:18, x:300, y:570},
           {id:19, x:320, y:570},
           {id:20, x:570, y:570}
   	]);
	
	window.edges = new EdgeCollection([
	       {id:1, v1:1, v2:2},
	       {id:2, v1:3, v2:4},
	       {id:3, v1:5, v2:1},
	       {id:4, v1:2, v2:7, p:-1},
	       {id:5, v1:8, v2:3},
	       {id:6, v1:4, v2:10},
	       {id:7, v1:6, v2:5},
	       {id:8, v1:7, v2:6, sl:2},
	       {id:9, v1:8, v2:7, sl:2},
	       {id:10, v1:9, v2:8, sl:2},
	       {id:11, v1:10, v2:9, p:-1},
	       {id:12, v1:6, v2:12, sl:2},
	       {id:13, v1:15, v2:9, sl:2},
	       {id:14, v1:11, v2:12, p:-1},
	       {id:15, v1:12, v2:13, sl:2},
	       {id:16, v1:13, v2:14, sl:2},
	       {id:17, v1:14, v2:15, sl:2},
	       {id:18, v1:15, v2:16},
	       {id:19, v1:17, v2:11},
	       {id:20, v1:13, v2:18},
	       {id:21, v1:19, v2:14, p:-1},
	       {id:22, v1:16, v2:20},
	       {id:23, v1:18, v2:17},
	       {id:24, v1:20, v2:19}
	]);
	
	window.obstacles = new ObstacleCollection([
	    {id:0, p:0,  edge: 3, s:0, type: 'static'},
	                                 
 	    {id:1, p:0,  edge: 4, s:0, type: 'car'},
	    {id:2, p:4,  edge: 4, s:0, type: 'car'},
	    {id:3, p:8, edge: 4, s:0, type: 'car'},
	    {id:4, p:12, edge: 4, s:0, type: 'car'},
	    {id:5, p:0,  edge: 1, s:0, type: 'car'},
	    {id:6, p:4,  edge: 1, s:0, type: 'car'},
	    {id:7, p:8, edge: 1, s:0, type: 'car'},
	    {id:8, p:12, edge: 1, s:0, type: 'car'},
 	    {id:9, p:0,  edge: 21, s:0, type: 'car'},
	    {id:10, p:4,  edge: 21, s:0, type: 'car'},
	    {id:11, p:8, edge: 21, s:0, type: 'car'},
	    {id:12, p:12, edge: 21, s:0, type: 'car'},
	    {id:13, p:0,  edge: 22, s:0, type: 'car'},
	    {id:14, p:4,  edge: 22, s:0, type: 'car'},
	    {id:15, p:8, edge: 22, s:0, type: 'car'},
	    {id:16, p:12, edge: 22, s:0, type: 'car'}, 
	]);
	
	/*
	window.vertexs = new VertexCollection([
        {id:0, x:100, y:100},
        {id:1, x:500, y:100},
        {id:2, x:500, y:500},
        {id:3, x:100, y:500},
        {id:4, x:120, y:480}
	]);
	
	window.edges = new EdgeCollection([
        {id:0, v1:0, v2:1},
        {id:1, v1:1, v2:2},
        {id:2, v1:2, v2:3},
        {id:3, v1:3, v2:0},
        {id:4, v1:1, v2:4},
        {id:5, v1:4, v2:3, p: -1}
	]);
	
	window.obstacles = new ObstacleCollection([
	    {id:0, p:0,  edge: 0, s:0, type: 'simple'},
	    {id:1, p:5,  edge: 0, s:0, type: 'simple'},
	    {id:2, p:10, edge: 0, s:0, type: 'simple'},
	    {id:3, p:15, edge: 0, s:0, type: 'simple'},
	    {id:4, p:0,  edge: 1, s:0, type: 'simple'},
	    {id:5, p:5,  edge: 1, s:0, type: 'simple'},
	    {id:6, p:10, edge: 1, s:0, type: 'simple'},
	    {id:7, p:15, edge: 1, s:0, type: 'simple'},
	    {id:8, p:0,  edge: 2, s:0, type: 'simple'}
	    //{id:9, p:1,  edge: 3, s:0, type: 'dummy'}
   	]);
   	*(
   	*
	/*
	window.obstacles = new ObstacleCollection([
 	    {id:0, p:0,  edge: 2, s:0, type: 'simple'},
 	    {id:1, p:8,  edge: 4, s:0, type: 'simple'}
 	    //{id:9, p:1,  edge: 3, s:0, type: 'dummy'}
    ]);
	*/
	
	window.e0 = window.edges.get(0);
	window.v0 = window.vertexs.get(0);
	
	var VertexView = ns.VertexView = Backbone.View.extend({
		
		initialize: function() {
			this.shape = new Kinetic.Circle({
				x: this.model.getX(),
				y: this.model.getY(),
				radius: 8,
				fill: 'black'
			});
			this.listenTo(this.model, 'change', this.update);
		},
		
		update: function() {
			this.shape.setX(this.model.getX());
			this.shape.setY(this.model.getY());
			this.trigger('dirty');
		},
		
		getShape: function() {
			return this.shape;
		}
		
	});
	
	var EdgeView = ns.EdgeView = Backbone.View.extend({
		
		initialize: function() {
			this.shape = new Kinetic.Line({
				points: this.getPoints(),
				stroke: 'black',
		        strokeWidth: 5
			});
			this.listenTo(this.model.get('v1'), 'change', this.update);
			this.listenTo(this.model.get('v2'), 'change', this.update);
		},
		
		getPoints: function() {
			return [
			    {x: this.model.get('v1').getX(), y: this.model.get('v1').getY()},
			    {x: this.model.get('v2').getX(), y: this.model.get('v2').getY()}
			];
		},
		
		update: function() {
			this.shape.setPoints(this.getPoints());
			this.trigger('dirty');
		},
		
		getShape: function() {
			return this.shape;
		}
		
	});
	
	var CarView = ns.CarView = Backbone.View.extend({
		
		initialize: function() {
			
			this.shape = new Kinetic.Group({
				x: this.model.getX(),
				y: this.model.getY()
			});
			
			this.circle = new Kinetic.Circle({
				radius: 7,
				fill: '#'+(Math.random()*0xFFFFFF<<0).toString(16)
			});
			
			this.text = new Kinetic.Text({
				x: -4,
				y: -4,
		        text: this.model.getId(),
		        fontSize: 12,
		        fontFamily: 'Calibri',
		        fill: 'white'
			});
			
			this.speedText = new Kinetic.Text({
				x: 5,
				y: 5,
		        text: this.model.getSpeed(),
		        fontSize: 12,
		        fontFamily: 'Calibri',
		        fill: 'red'
			});
			
			this.shape.add(this.circle);
			this.shape.add(this.text);
			this.shape.add(this.speedText);
			
			this.listenTo(this.model, 'change', this.update);
		},
		
		update: function() {
			this.shape.setX(this.model.getX());
			this.shape.setY(this.model.getY());
			this.speedText.setText(this.model.getSpeed());
			this.trigger('dirty');
		},
		
		getShape: function() {
			return this.shape;
		}
		
	});
	
	var CarAnimationView = ns.CarAnimationView = Backbone.View.extend({
		
		_animations: [],
		
		initialize: function() {
			
			this._animations = [];
			
			this.shape = new Kinetic.Group({
				x: this.model.getX(),
				y: this.model.getY()
			});
			
			this.circle = new Kinetic.Circle({
				radius: 7,
				fill: '#DDDDDD'
			});
			
			this.text = new Kinetic.Text({
				x: -4,
				y: -4,
		        text: this.model.getId(),
		        fontSize: 12,
		        fontFamily: 'Calibri',
		        fill: 'black'
			});
			
			this.speedText = new Kinetic.Text({
				x: 5,
				y: 5,
		        text: this.model.getSpeed(),
		        fontSize: 12,
		        fontFamily: 'Calibri',
		        fill: 'red'
			});
			
			this.shape.add(this.circle);
			this.shape.add(this.text);
			this.shape.add(this.speedText);
			
			this.listenTo(this.model, 'move', this.move);
		},
		
		move: function(path, position, speed) {
			//console.log('move', path, position, speed);
			this._animations.push({path: path, position: position, speed: speed, progress: 0});
		},
		
		getShape: function() {
			return this.shape;
		},
		
		renderAnimation: function(animation) {
			var position = ((animation.speed / 100) * animation.progress) + animation.position;
			//console.log('render ani', animation, position);
			
			// get path for position
			var i = 0;
			while (position > animation.path[i].getSteps()) {
				position -= animation.path[i].getSteps();
				i++;
			}
			// get coordinates an edge for position (corected)
			var vect = animation.path[i].getStepPosition(position);
			this.shape.setX(vect.x);
			this.shape.setY(vect.y);
			this.shape.setRotation(animation.path[i].getStepRotation(position));
			this.speedText.setText(animation.speed);
		},
		
		render: function(progress) {
			if (!this._animations.length) return;
			
			//while schleife
			if (this._animations[0].progress + progress > 100) throw new Error('multi animation progress not supported');
			
			this._animations[0].progress += progress;
			
			this.renderAnimation(this._animations[0]);
			
			if (this._animations[0].progress >= 100) {
				this._animations.shift();
				if (this._animations.length < 2) this.trigger('calc');
			}
			
			this.trigger('dirty');
		}
		
	});
	
	var AppView = ns.AppView = Backbone.View.extend({
		
		showCalculation: false,
		
		collisionTest: true,
		
		collisionDistance: 0.2,
		
		cars: [],
		
		events: {
		  "click #help": "openHelp"
		},
		
		initialize: function() {
			this.cars = [];
			this.stage = new Kinetic.Stage({
				container: 'container'
		    });
			this.initializeBackground();
			this.initializeVertexs();
			this.initializeEdges();
			this.updateWindowSize();
			this.carLayer = new Kinetic.Layer();
			this.addCars();
			this.stage.add(this.carLayer);
		},
		
		initializeBackground: function() {
			this.background = new Kinetic.Layer();
			this.backgroundRect = new Kinetic.Rect({
		        x: 0,
		        y: 0,
		        fill: 'green'
		    });

		    this.background.add(this.backgroundRect);
			this.stage.add(this.background);
		},
		
		initializeVertexs: function() {
			this.vertexLayer = new Kinetic.Layer();
			
			window.vertexs.each(function(vertex){
				var vertexView = new VertexView({model: vertex});
				this.listenTo(vertexView, 'dirty', this.dirtyVertex);
				this.vertexLayer.add(vertexView.getShape());
			}, this);
		    
			this.stage.add(this.vertexLayer);
		},
		
		dirtyVertex: function() {
			this.vertexLayer.draw();
		},
		
		initializeEdges: function() {
			this.edgeLayer = new Kinetic.Layer();
			
			window.edges.each(function(edge){
				var edgeView = new EdgeView({model: edge});
				this.listenTo(edgeView, 'dirty', this.dirtyEdges);
				this.edgeLayer.add(edgeView.getShape());
			}, this);
		    
			this.stage.add(this.edgeLayer);
		},
		
		dirtyEdges: function() {
			this.edgeLayer.draw();
		},
		
		updateWindowSize: function() {
			var ww = window.innerWidth;
			var wh = window.innerHeight;
			console.log(ww,wh);
			
			$('#container').css({width: ww, height: wh});
			
			this.stage.setWidth(ww);
			this.stage.setHeight(wh);
			
			this.backgroundRect.setWidth(ww);
			this.backgroundRect.setHeight(wh);
			this.background.draw();
		},
		
		addCars: function() {
			window.obstacles.each(function(obstacle){
				this.addObstacle(obstacle);
			}, this);    
		},
		
		dirtyCars: false,
		
		needCalc: false,
		
		addObstacle: function(obstacle) {
			
			if (this.showCalculation) {
				var carView = new CarView({model: obstacle});
				this.listenTo(carView, 'dirty', function(){ this.dirtyCars = true;});
				this.carLayer.add(carView.getShape());
			}
			
			var carAnimationView = new CarAnimationView({model: obstacle});
			this.listenTo(carAnimationView, 'dirty', function(){ this.dirtyCars = true;});
			this.listenTo(carAnimationView, 'calc', function(){ this.needCalc = true;});
			this.carLayer.add(carAnimationView.getShape());
			this.cars.push(carAnimationView);
		},
		
		render: function(progess) {
			_.each(this.cars, function(car){
				car.render(progess);
			});
			if (this.dirtyCars) {
				this.carLayer.draw();
				if (this.collisionTest) {
					_.each(this.cars, function(car){
						_.each(this.cars, function(other){
							if (car.cid == other.cid) return;
							
							if (Math.abs(car.shape.getX()-other.shape.getX()) < this.collisionDistance &&
								Math.abs(car.shape.getY()-other.shape.getY()) < this.collisionDistance) {
								console.log('car'+car.model.getId()+' animationView', car);
								console.log('car'+other.model.getId()+' animationView', other);
								console.log('Animationcollision! car'+car.model.getId()+' with car'+other.model.getId());
								//throw new Error('Animationcollision! car'+car.model.getId()+' with car'+other.model.getId());
							}
							
						}, this);
					}, this);
				}
			}
			if (this.needCalc) this.calculate();
			return this;
		},
		
		pickPriority: function(requests) {
			
			// first look for cars with "steps left on edge < car.minDistance"
			// this car has already won last request but needs more time
			for (var i=0; i<requests.length; i++) {
				var request = requests[i];
				if (request.car.getDistance(request.edge.get('v2')) < request.car.minDistance) {
					//console.log('picking last winner');
					return [request];
				}
			}
			
			// find bigest priority edge
			var priorityRequest = null;
			for (var i=0; i<requests.length; i++) {
				var request = requests[i];
				if (!priorityRequest || priorityRequest.edge.getPriority() < request.edge.getPriority()) {
					priorityRequest = request;
				}
			}
			return [priorityRequest];
			
			/*
			console.log('random picking');
			return requests[_.random(requests.length-1)];
			*/
		},
		
		calculate: function() {
			
			this.needCalc = false;
			
			var lockRequests = [];
			
			window.obstacles.each(function(obstacle){
				obstacle.resetPriority();
				obstacle.rendomize();
				_.each(obstacle.getGateways(), function(edge){ 
					if (lockRequests[edge.get('v2').getId()]) {
						lockRequests[edge.get('v2').getId()].push({
							'car': obstacle,
							'edge': edge
						});
					} else {
						lockRequests[edge.get('v2').getId()] = [{
							'edge': edge,
							'car': obstacle
						}];
					}
				});
			});
						
			_.each(lockRequests, function(requests) {
				var winningRequests = [];
				// if only one request or no collision possible
				if (requests.length == 1 || requests[0].edge.get('v2').get('endingEdges').length < 2) {
					winningRequests = requests;
				} else {
					winningRequests = this.pickPriority(requests);
				}
				_.each(winningRequests, function(request){
					request.car.addPriority(request.edge.get('v2'));
				});
				//console.log('selecting car'+request.car.getId()+' for priority on vetertex'+request.edge.get('v2').getId()+' an gateway edge'+request.edge.getId());
			}, this);
			
			window.obstacles.each(function(obstacle){
				obstacle.move();
			});
			
			if (this.collisionTest) {
				window.obstacles.each(function(obstacle){
					window.obstacles.each(function(other){
						if (obstacle.getId() == other.getId()) return;
						
						if (Math.abs(obstacle.getX()-other.getX()) < this.collisionDistance &&
							Math.abs(obstacle.getY()-other.getY()) < this.collisionDistance) {
							console.log('car'+obstacle.getId(), obstacle);
							console.log('car'+other.getId(), other);
							console.log('Collision! car'+obstacle.getId()+' with car'+other.getId());
							throw new Error('Collision! car'+obstacle.getId()+' with car'+other.getId());
						}
						
					}, this);
				}, this);
			}
			
		},
		
		removeStaticObstacles: function() {
			window.obstacles.each(function(obstacle) {
				if (obstacle instanceof StaticObstacle) {
					obstacle.get('edge').get('cars').remove(obstacle);
					obstacle.set({x: 0, y: 0});
					console.log('removing static', obstacle);
				}
			});
		},
		
		openHelp: function() {
			console.log('No help =)');
			//router.navigate("help", {trigger: true});
		}
    	
	});
	
	window.app = new AppView;
	
	app.render();
	
	app.calculate();
	app.calculate();
	
	
	
	(function animloop(){
		app.render(5);
		requestAnimationFrame(animloop);
		//setTimeout(animloop, 1000);
	})();
	
	for (var n=0; n<window.obstacles.length; n++) {
		var car = window.obstacles.get(n);
		console.log('car'+n, car);
		window['car'+n] = car;
	};
	
});

