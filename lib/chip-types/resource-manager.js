var Promise = require("bluebird");
var ResourceRepresentation = require("./resource-representation.js");

var UUIDGenerator = require("uid");

/**
 * Manages resources in the database
 * @class
 */
 var ResourceManager = new function(){

 	this.create = function(dispatcher, type_name, body, owner, access_mode, access_mode_args){
 		if(owner===undefined) owner=null;
 		if(access_mode===undefined) access_mode = "private";
 		if(access_mode_args==undefined) access_mode_args = [];
 		if(!Sealious.ChipManager.chip_exists("resource_type", type_name)){
 			throw new Sealious.Errors.ValidationError("Unknown resource type: " + type_name);
 		}
 		var resource_type_object = Sealious.ChipManager.get_chip("resource_type", type_name);

 		var encoded_body = null;

 		return new Promise(function(resolve, reject){
 			resource_type_object.validate_field_values(body)
 			.then(
 				function(){
 					return resource_type_object.encode_field_values(body);
 				}).then(
 				function(response){
 					encoded_body = response;
 					var newID = UUIDGenerator(10);
 					var resource_data = {
 						sealious_id: newID,
 						type: type_name,
 						body: encoded_body
 					};
 					resource_data.owner = owner;
 					resource_data.access_mode = access_mode;
 					resource_data.access_mode_args = access_mode_args;

 					dispatcher.datastore.insert("resources", resource_data, {}).then(function(data){
 						var database_entry = data[0];
 						var resource = new ResourceRepresentation(database_entry);
 						resolve(resource.getData());
 					});
 				}
 				).catch(function(e){
 					reject(e);
 				});
 			})

 	}

 	this.edit_resource_access_mode = function(dispatcher, resource_id, access_mode, access_mode_args){
 		if(arguments.length==3){
 			access_mode_args={};
 		}
 		return dispatcher.datastore.update("resources", {sealious_id: resource_id }, { $set: { access_mode:access_mode, access_mode_args: access_mode_args} });
 	}

 	this.get_resource_access_mode = function(dispatcher, resource_id){
 		return new Promise(function(resolve,reject){
 			dispatcher.datastore.find("resources", { sealious_id: resource_id }, {})
 			.then(function(documents){
 				var database_entry = documents[0];

 				var resource = new ResourceRepresentation(database_entry);
 				resolve(resource.get_access_mode());
 			}); 		
 		});
 	}

 	this.delete = function(dispatcher, type_name, id){
 		if(!Sealious.ChipManager.chip_is_registred("resource_type." + type_name)){
 			throw new Sealious.Errors.ValidationError("Unknown resource type: " + type_name);
 		}

 		return new Promise(function(resolve, reject){
 			dispatcher.datastore.delete("resources", {sealious_id: id, type: type_name}, {})
 			.then(function(data){
 				resolve();
 			}).catch(function(e){
 				reject(e);
 			});
 		})

 	}

	/**
	 * Callback for idExists
	 * @callback ResourceManager~idExistsCallback
	 * @param {Boolean} exists - true if a resource with given id exists
	 */

	 this.get_by_id = function(dispatcher, resource_id){
	 	return new Promise(function(resolve,reject){
	 		dispatcher.datastore.find("resources", { sealious_id: resource_id }, {})
	 		.then(function(documents){
	 			if (documents[0] === undefined) {
	 				reject(new Sealious.Errors.NotFound("resource of id " + resource_id + " not found"));
	 			} else {
	 				var database_entry = documents[0];
	 				var resource = new ResourceRepresentation(database_entry);
	 				resolve(resource.getData());
	 			}
	 		});
	 	});
	 }

	 this.list_by_type = function(dispatcher, type_name, params) {
	 	if(arguments.length==2){
	 		params = {};
	 	}
	 	return new Promise(function(resolve, reject){
	 		if(!Sealious.ChipManager.chip_exists("resource_type", type_name)){
	 			reject(new Sealious.Errors.ValidationError("resource type "+type_name+" does not exist"));
	 		}else{
	 			dispatcher.datastore.find("resources", { type: type_name }, {}, params).then(function(response) {
	 				var ret = response.map(function(database_entry){
	 					return new ResourceRepresentation(database_entry).getData();
	 				})
	 				resolve(ret);
	 			})
	 		}
	 	})
	 }

	 this.find = function(dispatcher, field_values, type){
	 	if(arguments.length==2){
	 		type = null;
	 	}
	 	return new Promise(function(resolve, reject){
	 		var query = {};
	 		if(type){
	 			query.type = type;
	 		}
	 		for(var field_name in field_values){
	 			query["body." + field_name] = field_values[field_name];
	 		}
	 		dispatcher.datastore.find("resources", query)
	 		.then(function(documents){
	 			var parsed_documents = documents.map(function(document){return new ResourceRepresentation(document).getData()});
	 			resolve(parsed_documents);
	 		})
	 	})
	 }

	 this.update_resource = function(dispatcher, resource_id, new_resource_data){
	 	var query = {};

	 	if(new_resource_data.hasOwnProperty("sealious_id")){
	 		delete new_resource_data.sealious_id;
	 	}
	 	if(new_resource_data.hasOwnProperty("id")){
	 		delete new_resource_data.id;
	 	}

	 	for(var field_name in new_resource_data){
	 		query["body." + field_name] = new_resource_data[field_name];
	 	}

	 	return dispatcher.datastore.update("resources", {sealious_id: resource_id}, {$set: query});
	 }

	 this.search = function(dispatcher, type, field_name, query_string){
	 	query = {body: {}};
	 	query["body"][field_name] = new RegExp(query_string, "gi");
	 	return new Promise(function(resolve, reject){
	 		dispatcher.datastore.find("resources", query)
	 		.then(function(documents){
	 			var resource_representations = documents.map(function(document){return new ResourceRepresentation(document).getData()});
	 			resolve(resource_representations);
	 		})
	 	})
	 }

	 this.search_by_mode = function(dispatcher, type, mode){
	 	return new Promise(function(resolve, reject){	
	 		dispatcher.datastore.find("resources", {access_mode: mode, type: type}, {})
	 		.then(function(documents){
	 			var database_entry = documents;
	 			var resource_representations = documents.map(function(document){
	 				return new ResourceRepresentation(document).getData()
	 			});
	 			resolve(resource_representations);
	 		});
	 	});
	 }

	 this.get_resource_type_signature = function(dispatcher, type_name){
	 	return new Promise(function(resolve, reject){
	 		var resource_type_chip = Sealious.ChipManager.get_chip("resource_type", type_name);
	 		if(resource_type_chip){
	 			resolve(resource_type_chip.get_signature());
	 		}else{
	 			reject(new Sealious.Errors.Error("ResourceManager tried to access chip type `" + type_name + "`, which does not exist."));
	 		}
	 	})
	 }
	}


	module.exports = ResourceManager;