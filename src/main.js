$(function(){
	
	var Vertex = Backbone.RelationalModel.extend({
		
		getX: function() {
			return this.get('x');
		},
		
		getY: function() {
			return this.get('y');
		}
	});
	
	var VertexCollection = Backbone.Collection.extend({
		  		
		model: Vertex
		
	});
	
	var Edge = Backbone.RelationalModel.extend({
		
		relations: [
    		{
    			type: Backbone.HasOne,
    			key: 'v1',
    			relatedModel: Vertex,
    			collectionType: VertexCollection,
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
		
		
		
		getLength: function() {
			var x = Math.abs(this.get('v1').getX()-this.get('v2').getX());
			var y = Math.abs(this.get('v1').getY()-this.get('v2').getY());
			return Math.sqrt(Math.pow(x, 2)+Math.pow(y, 2));
		}
	
	});
	
	var EdgeCollection = Backbone.Collection.extend({
  		
		model: Edge
		
	});
	
	var Car = Backbone.RelationalModel.extend({
		
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
		
		getX: function() {
			return this.get('x');
		},
		
		getY: function() {
			return this.get('y');
		},
		
		calculte: function() {
			console.log('overwrite this method!');
		}
	});
	
	var SimpleCar = Car.extend({
		
		_path: [],
		
		_position: 0,
		
		maxSpeed: 10,
		
		speed: 0,
		
		dawdle: 0.3,
				
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
				length += edge.getLength();
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
			console.log('choosing', r, possibilities);
			return r;
		},
		
		/**
		 * bilde kette in path bis die kette die länge speed hat
		 * suche in der kette nach hinternisen und 
		 * gib die länge bis zum hinderniss order speed zurück
		 * 
		 * @returns {Number}
		 */
		getMaxWay: function() {
			if (this.speed == 0) {
				console.log('warning getMaxWay with speed 0');
				return 0;
			}
			while ((this.getPathLength()-this._position) < this.speed) {
				this._path.push(this.getNextEdge());
			}
			var offset = 0;
			var next = this.speed;
			for (var i=0; i<this._path.length; i++) {
				var edge = this._path[i];
				var cars = edge.get('cars');
				//console.log(edge, edge.get('cars'));

				cars.each(function(car){
					if (car.cid == this.cid) return;
					var distance = offset + car.getPosition() - this.getPosition();
					if (distance <= 0) return; // car is not in front
					if (distance < next) next = distance;
				}, this);
				
				if (next < this.speed) return next;
				offset += edge.getLength();
				if (offset >= this.speed) return this.speed;
			}
			return this.maxSpeed;
		},
		
		/**
		 * setze x und y anhand der kette und der position
		 * entferne das erste glid der kette wenn die position auf dem 2ten ist.
		 * postion update!!! UND car von edge entferen und hinzufügen
		 */
		updatePosition: function() {
			//console.log('updatePosition', this);
			this._position += this.speed;
			while (this._position > this._path[0].getLength()) {
				console.log('removing first');
				var edge = this._path[0];
				edge.get('cars').remove(this);
				this._position -= edge.getLength();
				this._path.shift();
				this._path[0].get('cars').add(this);
			}
			var edge = this._path[0];
			var p = this._position / edge.getLength();
			var x = edge.get('v1').getX()-edge.get('v2').getX();
			var y = edge.get('v1').getY()-edge.get('v2').getY();
			var newPos = {
				x: edge.get('v1').getX()-(x*p),
				y: edge.get('v1').getY()-(y*p),
			};
			//console.log('new pos', newPos);
			this.set(newPos);
			
		},
		
		calculate: function() {
			if (this.speed < this.maxSpeed) this.speed++;
			var maxWay = this.getMaxWay();
			if (this.speed > maxWay) this.speed = maxWay;
			if (Math.random()-this.dawdle <= 0) this.speed--;
			if (this.speed < 0) this.speed = 0;
			this.updatePosition();
			//console.log(this.speed, maxWay, this._position);
		}
		
	});
	
	var CarCollection = Backbone.Collection.extend({
		  		
		model: SimpleCar
		
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
        {id:4, v1:3, v2:0}
	]);
	
	window.cars = new CarCollection([
	    {id:0, p:  0, edge: 0},
	    {id:1, p:100, edge: 0},
	    {id:2, p:200, edge: 0},
	    {id:3, p:300, edge: 0},
	    {id:4, p:  0, edge: 1},
	    {id:5, p: 50, edge: 1},
	    {id:6, p:100, edge: 1},
	    {id:7, p:150, edge: 1},
	    {id:8, p:200, edge: 1}
   	]);
	
	window.e0 = window.edges.get(0);
	window.v0 = window.vertexs.get(0);
	
	var VertexView = Backbone.View.extend({
		
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
	
	var EdgeView = Backbone.View.extend({
		
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
	
	var CarView = Backbone.View.extend({
		
		initialize: function() {
			this.shape = new Kinetic.Circle({
				x: this.model.getX(),
				y: this.model.getY(),
				radius: 7,
				fill: '#'+(Math.random()*0xFFFFFF<<0).toString(16)
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
	
	var AppView = Backbone.View.extend({
		
		events: {
		  "click #help": "openHelp"
		},
		
		initialize: function() {			
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
		
		addCar: function(car) {
			var carView = new CarView({model: car});
			this.listenTo(carView, 'dirty', function(){ this.dirtyCars = true;});
			this.carLayer.add(carView.getShape());
		},
		
		render: function() {
			if (this.dirtyCars) this.carLayer.draw();
			return this;
		},
		
		openHelp: function() {
			console.log('No help =)');
			//router.navigate("help", {trigger: true});
		}
    
	});
	
	window.app = new AppView;
	app.render();
	
	(function animloop(){
		requestAnimationFrame(animloop);
		app.render();
	})();
	
	var gui = require('nw.gui');
	gui.Window.get().showDevTools();
	
	
	(function calculate(){
		window.cars.each(function(car){
			car.calculate();
		});
		setTimeout(calculate, 10);
	})();
});

