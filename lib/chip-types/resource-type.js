var Promise = require("bluebird");

var merge = require("merge");

var Chip = require("./chip.js");
var ResourceTypeField = require("./resource-type-field.js");

var ResourceType = function(parent_module_path, name){
	Chip.call(this, parent_module_path, true, "resource_type", name);
	this.fields = {};
	this.references = {};
	this.keys = {};
}

ResourceType.prototype = new function(){

	this.add_field = function(field_declaration){
		var field_object = new ResourceTypeField(field_declaration);
		var field_name = field_object.name;
		if(!this.keys[field_name]){
			this.fields[field_name] = field_object;
			this.keys[field_name] = field_object;
		}
	} 

	this.add_fields = function(field_declarations_array){
		for(var i in field_declarations_array){
			var declaration = field_declarations_array[i];
			this.add_field(declaration);
		}
	}

	function ensure_no_unknown_fields(values){
		var validation_errors = {};
		for(var field_name in values){
			if(this.keys[field_name]==undefined){
				validation_errors[field_name] = "unknown_field";
			}
		}
		return validation_errors;
	}

	function ensure_no_missing_required_fields(values){
		var validation_errors = {};
		for(var i in this.keys){
			var field = this.keys[i];
			if(field.required && !values[field.name]){
				validation_errors[field.name] = "missing_value";
			}
		}
		return validation_errors;
	}

	this.validate_field_values = function(values){
		var that = this;
		var validation_errors = {};
		return new Promise(function(resolve, reject){
			validation_errors = merge(validation_errors, ensure_no_unknown_fields.call(that, values));
			validation_errors = merge(validation_errors, ensure_no_missing_required_fields.call(that, values));
			var promise_array = [];
			for(var key in values){
				if(validation_errors[key]===undefined){
					var temp_promise = that.keys[key].isProperValue(values[key]);
					promise_array.push(temp_promise);					
				}
			}

			var error_message = "There are problems with some of the provided values";//TODO: ładnie generować tekst podsumowujący problem z inputem

			Promise.all(promise_array)
			.then(function(result){
				if(Object.keys(validation_errors).length>0){
					throw new Sealious.Errors.ValidationError(error_message, {invalid_fields: validation_errors});
				}else{
					resolve();					
				}
			})
			.catch(function(error){
				validation_errors = merge(validation_errors, error);
				reject(new Sealious.Errors.ValidationError(error_message, {invalid_fields: validation_errors}));					
			});
			
		})
	}

	this.encode_field_values = function(body){
		var promises = [];
		for(var field_name in body){
			var current_value = body[field_name];
			promises.push(this.keys[field_name].encode_value(current_value, true));
		}
		return Promise.all(promises).then(function(responses){
			return new Promise(function(resolve, reject){
				resolve(merge.apply(merge, responses));
			})
		});
	}

	this.get_signature = function(){
		var resource_type_signature = [];
		for(var field_name in this.fields){
			var field_signature = this.fields[field_name].get_signature();
			resource_type_signature.push(field_signature);
		}
		return resource_type_signature;
	}

}

ResourceType.is_a_constructor = false;

module.exports = ResourceType;