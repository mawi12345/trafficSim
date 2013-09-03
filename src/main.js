/**

TODO!!!

revert to pre simulation

first simulate all priority cars and lock passed vertexes
for non priority cars - then calculate !!!!

 */

$(function(){
	
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
		
		getGivePriority: function() {
			return (!!this.get('gp'));
		}
	
	});
	
	var EdgeCollection = ns.EdgeCollection = Backbone.Collection.extend({
  		
		model: Edge
		
	});
	
	var Car = ns.Car = Backbone.RelationalModel.extend({
		
		subModelTypes: {
			'dummy': 'DummyCar',
			'simple': 'SimpleCar'
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
			console.log('overwrite this method!');
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
		}
		
		
		
	});
	
	var DummyCar = ns.DummyCar = Car.extend({
		
		calculate: function() {},
		
		move: function() {
			var edge = this.get('edge');
			this.set(edge.getStepPosition(this.get('p')));
		}
		
	});
	
	var SimpleCar = ns.SimpleCar = Car.extend({
		
		_path: [],
		
		_position: 0,
		
		maxSpeed: 5,
				
		dawdle: 0.0,
		
		acceleration: 0.05,
		
		minDistance: 1,
		
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
				length += edge.getSteps();
			});
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
			
			var offset = -this.minDistance;
			var posOnEdge = this.getPosition();
			var next = speed;
			for (var i=0; i<this._path.length; i++) {
				var edge = this._path[i];
				var cars = edge.get('cars');

				cars.each(function(car){
					if (car.cid == this.cid) return;
					var distance = car.getPosition() + offset - posOnEdge;
					if (distance < 0) return; // car is not in front
					if (distance < next) next = distance;
				}, this);
				
				if (next < speed) return next;
				offset += edge.getSteps() - posOnEdge;
				
				if (!overwritePriority && !this.hasPriority(edge.get('v2'))) {
					return offset;
				}
				
				posOnEdge = 0;
				if (offset >= speed) return speed;
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
			
			var vertexs = [];
			
			var speed = this.getNextSpeed(true, this.minDistance);
						
			var position = this._position + speed;
			
			var i = 0;
			while (position >= this._path[i].getSteps()) {
				position -= this._path[i].getSteps();
				vertexs.push(this._path[i]);
				i++;
			}
			
			return vertexs;
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
			if (newSpeed < 0) return 0;
			return newSpeed;
		}
		
	});
	
	var CarCollection = ns.CarCollection = Backbone.Collection.extend({
		  		
		model: Car
		
	});
	
	window.vertexs = new VertexCollection([
        {id:0, x:100, y:100},
        {id:1, x:500, y:100},
        {id:2, x:500, y:500},
        {id:3, x:100, y:500}
	]);
	
	window.edges = new EdgeCollection([
        {id:0, v1:0, v2:1},
        {id:1, v1:1, v2:2},
        {id:2, v1:2, v2:3},
        {id:3, v1:3, v2:0},
        {id:4, v1:1, v2:3, gp: true}
	]);
	
	window.cars = new CarCollection([
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
   	
	/*
	window.cars = new CarCollection([
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
				radius: 10,
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
			window.cars.each(function(car){
				this.addCar(car);
			}, this);    
		},
		
		dirtyCars: false,
		
		needCalc: false,
		
		addCar: function(car) {
			
			if (this.showCalculation) {
				var carView = new CarView({model: car});
				this.listenTo(carView, 'dirty', function(){ this.dirtyCars = true;});
				this.carLayer.add(carView.getShape());
			}
			
			var carAnimationView = new CarAnimationView({model: car});
			this.listenTo(carAnimationView, 'dirty', function(){ this.dirtyCars = true;});
			this.listenTo(carAnimationView, 'calc', function(){ this.needCalc = true;});
			this.carLayer.add(carAnimationView.getShape());
			this.cars.push(carAnimationView);
		},
		
		render: function(progess) {
			_.each(this.cars, function(car){
				car.render(progess);
			});
			if (this.dirtyCars) this.carLayer.draw();
			if (this.needCalc) this.calculate();
			return this;
		},
		
		pickPriority: function(requests) {
			//TODO: first look for cars with "steps left on edge < car.minDistance"
			//      this car has already won last request but needs more time
			console.log('random picking');
			return requests[_.random(requests.length-1)];
		},
		
		calculate: function() {
			
			this.needCalc = false;
			
			var lockRequests = [];
			
			window.cars.each(function(car){
				car.resetPriority();
				car.rendomize();
				_.each(car.getGateways(), function(edge){ 
					if (lockRequests[edge.get('v2').getId()]) {
						lockRequests[edge.get('v2').getId()].push({
							'car': car,
							'edge': edge
						});
					} else {
						lockRequests[edge.get('v2').getId()] = [{
							'edge': edge,
							'car': car
						}];
					}
				});
			});
						
			_.each(lockRequests, function(requests) {
				var request;
				if (requests.length == 1) {
					request = requests[0];
				} else {
					request = this.pickPriority(requests);
				}
				request.car.addPriority(request.edge.get('v2'));
				//console.log('selecting car'+request.car.getId()+' for priority on vetertex'+request.edge.get('v2').getId()+' an gateway edge'+request.edge.getId());
			}, this);
			
			window.cars.each(function(car){
				car.move();
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
		requestAnimationFrame(animloop);
		app.render(5);
		//setTimeout(animloop, 1000);
	})();
	
	var gui = require('nw.gui');
	gui.Window.get().showDevTools();
	
	
	for (var n=0; n<window.cars.length; n++) {
		var car = window.cars.get(n);
		console.log('car'+n, car);
		window['car'+n] = car;
	};
	
	/*
	(function calculate(){
		var simulations = [];
		window.cars.each(function(car){
			car.calculate();
			simulations.push(car.simulate());
		});
		
		//console.log(simulations);
		
		_.each(simulations, function(simulation) {
			_.each(simulations, function(other) {
				if (simulation.car.getId() == other.car.getId()) return;
				if (simulation.edge.getId() == other.edge.getId() &&
					simulation.position == other.position &&
					simulation.edge.getGivePriority()) {
					console.log('GIVE');
					simulation.car.givePriority();
				}
			});
		});
		
		window.cars.each(function(car){
			car.move();
		});
		setTimeout(calculate, 10);
	})();
	*/
});

