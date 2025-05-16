/*
 * This is custom record.js which is extended from Record View
 * Task:
     1. if case modules is closed then tag field none editable.
	 2.validations on remove attachment files based on the below conditions:
		-Logged in user = Owner of File A and Logged in user ? Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status ? Completed
			-Logged in user ? Owner of File A and Logged in user = Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status ? Completed
			-Logged in user ? Owner of File A and Logged in user ? Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status ? Completed
			-Logged in user = Owner of File A and Logged in user = Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status = Completed
			-Logged in user = Owner of File A and Logged in user ? Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status = Completed
			-Logged in user ? Owner of File A and Logged in user = Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status = Completed
			-Logged in user ? Owner of File A and Logged in user ? Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status = Completed
	 3.validations on Add attachment files based on the below conditions:
		-If Service Task Status == Completed and does not belong to Customer Service Supervisor Role and linked cases status is not closed or closed
	 4.When we click on Attachment field and Press backspace key then restrict to backspace.	
	-CR #76 -Requirement 2:
	1.Process name -Auto-populate the process name from the Process matrix module based on the values selected in the Area, Category and Sub-category.
	2.Criteria for auto-assignment -Auto-populate from the process matrix record based on the process name.
	3.CPU function -Auto-populate from the process matrix record based on the process name.
	4.Product -Auto-populate from the linked Loan Contract record selected in the LOS ID field
	5.Region -Auto-populate from the linked Loan Contract record selected in the LOS ID field
	6.Deposit of Bank -Visible and mandatory based on the linked process name. 
	7.Send To CPU button -Visible if Serviced by CPU = Yes for the linked process name and Assigned to user’s department ? Central Operations
	8.Send to CPU flag -Auto set as true when the Send to CPU button is clicked. 
	9.Rerout to Creator -Visible if Send to CPU flag = true and logged in user’s department = Central Operations and Reroute to creator flag = False
	On click of this option, the service task will be assigned to the ‘Created by’ and an alert message - The service task has been assigned successfully - will be displayed on the service task record view.
	10.Rerout to creator flag -Auto set as true when the Reroute to creator button is clicked.
*/

({    
    extendsFrom: 'RecordView',
	
	/* Backspace button events */
	customEvents: {
		"keyup .multi-attachments-detail-view": "disableBackspace",
		"click a[name=send_to_CPU_btn]": "sendToCPUButton",
		"click a[name=reroute_to_creator]": "rerouteToCreatorButton",
	},
	initialize: function(options) {
		
		this._super('initialize', [options]);
		if (this.events) {
			// Extend events hash with my events if one already exists
			_.extend(this.events, this.customEvents);
		}
		this.onloadView();
		this.listenTo(this.collection, 'data:sync:complete', this.onloadView);
		
		this.model.once( "sync",
            function() {
                this.model.on('change:cases_st_service_tasks_1_name', this._OnCaseChange, this);
				this.model.on("change:area_c", this.acsValidation, this);
				this.model.on("change:category_c", this.acsValidation, this);
				this.model.on("change:sub_category_c", this.acsValidation, this);
				this.model.on('change:status_c', this.resolutionFieldValidation, this);//CR 76 resolution_c validation
            },
            this
        );
		this.listenTo(this.collection, 'data:sync:complete', this.setUserName);
		this.model.on('change:assigned_user_name', this.hide_show_fields, this);
		
		this.listenTo(this.collection, 'data:sync:complete', this.setTagReadOnly); //Call after data render
		this.listenTo(this.collection, "data:sync:complete", this.acsValidation);
		this.listenTo(this.collection, "data:sync:complete", this.showActionButton); //Call after data render
		
		/* Define field array to show and hide field based on Process Matrix record */
		var fieldArray = {};
		this.fieldArray = {
		  "Deposit of Bank": "deposit_of_bank_c",
		};
		/* Define Session variable to apply required validation based on Process Matrix record */
		sessionStorage.setItem("mandatory_fields"+this.model.get("id"), "");
		/* Define Session variable to apply visibility validation based on Process Matrix record */
		sessionStorage.setItem("show_fields_c"+this.model.get("id"), "");
		/* Define Session variable to show Send to CPU button based on assigned user department fo ST record */
		sessionStorage.setItem("assigned_user_dept"+this.model.get("id"), "");
		
	},
	
	//Set Process Name from Process matrix module based on the values selected in the Area, Category and Sub-category. 
	acsValidation: function () {
		let self = this;
		self.hideacsfield();
		let areaText = self.model.get("area_c");
		let categoryText = self.model.get("category_c");
		let subCategoryText = self.model.get("sub_category_c");				
		
		//to define session variable for store value of service by CPU in Process matrix record to show Send to CPU button
		sessionStorage.setItem("send_to_CPU"+self.model.get("id"), "");

		//if Area,Category and Sub-category values not equal to blank then call Process matrix API
		if (areaText != "" && categoryText != "" && subCategoryText != "") {			
		  /* Process Matrix data based on ACS */
		  var url = app.api.buildURL("PM_process_matrix", null, null, {
			filter: [
			  {
				area_c: areaText,
				category_c: categoryText,
				subcategory_c: subCategoryText,
			  },
			],
		  });

		  app.api.call(
			"read",
			url,
			null,
			{
			  success: _.bind(function (response) {
				if (response.records != "") {
				  //Set process name mandatory_fields_c
				  self.model.set("pm_process_matrix_id_c",response.records[0].id); //new relate field added
				  self.model.set("process_name_c",response.records[0].name);			  
				  self.model.set("cpu_function_c",response.records[0].cpu_function_c); 
				  self.model.set("criteria_for_auto_assignment_c",response.records[0].criteria_for_auto_assignment_c);
				  
				  var servicedBycpu = response.records[0].serviced_by_cpu_c;
				  sessionStorage.setItem("send_to_CPU"+self.model.get("id"), servicedBycpu);
				  /* Show fields based on Process matrix record */
				  sessionStorage.setItem("show_fields_c"+self.model.get("id"),response.records[0].show_fields_c);
				  for (var key in response.records[0].show_fields_c) {
					
					let checkShowField = response.records[0].show_fields_c[key];
					if (checkShowField == "Deposit of Bank") {
						self.$("div[data-name=" +self.fieldArray[response.records[0].show_fields_c[key]] +"]").removeClass("vis_action_hidden");
					}
				  }

				  /* Set mandatory_fields based on Process matrix record */
				  sessionStorage.setItem("mandatory_fields"+self.model.get("id"),response.records[0].mandatory_fields_c);
				  for (var key in response.records[0].mandatory_fields_c) {
					let checkMandatoryField = response.records[0].mandatory_fields_c[key];
					
					if (checkMandatoryField == "Deposit of Bank") {						
						self.model.addValidationTask(
						  self.fieldArray[response.records[0].mandatory_fields_c[key]],
						  _.bind(self._doValidateSetRequired, self)
						);
					}
				  }
				} else {
				  //Removed process name
				  self.model.set("pm_process_matrix_id_c",""); //new relate field added
				  self.model.set("process_name_c", "");
				  self.model.set("cpu_function_c",""); 
				  self.model.set("criteria_for_auto_assignment_c","");
				}
			  }, this),
			  error: _.bind(function (error) {
				// here is your error code
				console.log("Error", error);
			  }, this),
			},
			{ async: false }
		  );
		}
	  },
	
	//Visible Deposit of Bank field based on the linked process name. 	
	hideacsfield: function () {
		var self = this;
		for (var key in self.fieldArray) {			
		  if (self.fieldArray[key] == "deposit_of_bank_c") {
			self.$("div[data-name=" + self.fieldArray[key] + "]").addClass("vis_action_hidden");
		  }
		}
	},

	//Mandatory Deposit of Bank field based on the linked process name.   
	_doValidateSetRequired: function (fields, errors, callback) {
		let checkField = sessionStorage.getItem("mandatory_fields"+this.model.get("id"));
		if (checkField != "") {
		  checkField = checkField.split(",");		  
		  for (var key in checkField) {			
			if (checkField[key]=="Deposit of Bank" && _.isEmpty(this.model.get(this.fieldArray[checkField[key]]))) {
			  errors[this.fieldArray[checkField[key]]] =
				errors[this.fieldArray[checkField[key]]] || {};
			  errors[this.fieldArray[checkField[key]]].required = true;
			}
		  }
		}

		callback(null, fields, errors);
	},

	//Show Action buttons on record view in Action dropd button based on conditions.
	showActionButton: function () {	  
		let self = this;
		let sendToCPUFlag = self.model.get("send_to_cpu_flag_c");
		let rerouteToCreatorFlag = self.model.get("reroute_to_creator_flag_c");
		let loggedInUserDept = app.user.get("sugar_logic_fields").department;
		let flag = false;	
		$(".custom_action_button").parent().addClass("parent_custom_action_button");		
		let sendToCPUBtn = "";
		let rerouteToCreator = "";

		//Show Send to CPU button if Service by CPU is Yes and assigned user department is not equal to Central Operations
		if ( sessionStorage.getItem("send_to_CPU"+self.model.get("id")) == "Yes" && sessionStorage.getItem("assigned_user_dept"+self.model.get("id")) != "Central Operations" && sessionStorage.getItem("assigned_user_dept"+self.model.get("id")) != "null") {
		  flag = true;
		  sendToCPUBtn =
			'<li class="CPU"><span sfuuid="24" class="detail"><a href="javascript:void(0);" class="" role="button" tabindex="0" name="send_to_CPU_btn" track="click:send_to_CPU_btn">Send to CPU</a></span></li><li class="divider CPU"><span sfuuid="25"></span></li>';
		}

		//Show Rerout to creator button if Send to CPU flag is true and logge in user department is Central Operations and reroute to creator flag is false
		if (sendToCPUFlag == true && loggedInUserDept == "Central Operations" && rerouteToCreatorFlag == false) {
		  flag = true;
		  rerouteToCreator =
			'<li class="reroute_to_creator"><span sfuuid="24" class="detail"><a href="javascript:void(0);" class="" role="button" tabindex="0" name="reroute_to_creator" track="click:reroute_to_creator">Reroute to creator</a></span></li><li class="divider reroute_to_creator"><span sfuuid="25"></span></li>';
		}

		//Create button html to append
		let btnHtml =
		  '<span sfuuid="22" class="fieldset actions detail btn-group"><span sfuuid="23" class="detail"><a href="javascript:void(0)" class="rowaction btn btn-primary" data-event="button:edit_button:click" role="button" tabindex="0" name="edit_button" track="click:edit_button">Actions</a></span><a style="padding: 6.6px;" track="click:actiondropdown" class="btn dropdown-toggle btn-primary" data-toggle="dropdown" href="javascript:void(0);" data-placement="bottom" rel="tooltip" title="" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false" aria-label="Actions" data-original-title="Actions"><span class="fa fa-caret-down"></span></a><ul data-menu="dropdown" class="dropdown-menu" role="menu">' +
		  
		  sendToCPUBtn +
		  rerouteToCreator +
		  "</ul></span>";
		
		if(flag == true){
			if ($(".custom_action_button").length) {
				$(".custom_action_button").parent().html(btnHtml);
			} else {
				$(".parent_custom_action_button").html(btnHtml);
			}
		}
		else{
			$(".parent_custom_action_button").html('');
		}  
		
	  },

	//Get Assigned to user department by user id.  
	getAssignedUserDept: function(){
		let self = this;
		let assignedUserId = self.model.get("assigned_user_id");
		let loggedInUserId = app.user.get('id');
		
		if(loggedInUserId == assignedUserId){			
			//Set session variable assigned_user_dept
			sessionStorage.setItem("assigned_user_dept"+self.model.get("id"),app.user.get("sugar_logic_fields").department);
		}else if (typeof assignedUserId !== "undefined") {			
			  App.api.call(
				"GET",
				App.api.buildURL("UserData/" + assignedUserId),
				null,
				{
				  success: function (data) {
					if (data.code == "200") {
					  //Set session variable assigned_user_dept
					  sessionStorage.setItem("assigned_user_dept"+self.model.get("id"),data.result.department);				  
					} else {
					  console.log("NO Record Found");
					}
				  },
				  error: function (e) {
					console.log("Something wrong with stage value");
				  },
				},
				{ async: false }
			  );
		}
	},	
	
	//Call function ffter click on Send to CPU button
	sendToCPUButton: function () {
		let self = this;	
		let criteria = self.model.get("criteria_for_auto_assignment_c");
		  /* Check Criteria */
		  if (criteria == "Deposit of Bank" && self.model.get("deposit_of_bank_c") != "") {
			/* Retrieves Group user name from the COPS assignment custom module based on the matching Deposit of Bank value on the service task record */
			let url = app.api.buildURL("COPSAssignment", null, null, {
			  filter: [
				{
				  criteria_for_auto_assignment_c: criteria,
				  deposit_of_bank_value_c: self.model.get("deposit_of_bank_c"),
				  APIFlag: "servicetaskAPI",
				},
			  ],
			});
			app.api.call(
			  "read",
			  url,
			  null,
			  {
				success: _.bind(function (response) {
				  /* Get group user id */
				  if (response.code == 200 && response.record.group_user_id) {
					  let groupId = response.record.group_user_id;
							/* Set group user */
							self.model.set("assigned_user_id", groupId);
							self.model.set("send_to_cpu_flag_c", true);
							//self.model.save();
							//Loader
							app.alert.show("massexport_loading", {
								level: "process",
								title: app.lang.get("LBL_LOADING"),
							  });
							// Save the model to the server
							self.model.save(null, {
								success: function(model, response) {
									//removed loader
									app.alert.dismiss("massexport_loading");
									app.alert.show("message-id", {
										level: "success",
										messages: "The service task has been assigned successfully",
										autoClose: true,
									});
								},
							});
					
				  } else {
					console.log("No group user name found for send to CPU");
					app.alert.show("message-id", {
						level: "error",
						title: "error",
						messages:
						  "The service task assignment has been failed",
						autoClose: false,
					});
				  }
				}, this),
				error: _.bind(function (error) {
				  // here is your error code
				  console.log("Error", error);
				}, this),
			  },
			  { async: false }
			);
		  }		  
		  /*Retrieves Group user name from the COPS assignment custom module based on the matching Product and Region value on the service task record*/
		  if (criteria == "Product and Region" && self.model.get("product_c") != "" && self.model.get("region_c") != "") {
			let cpuFunction = self.model.get("cpu_function_c");
			let product = self.model.get("product_c");
			let region = self.model.get("region_c");

			/* Get Units cops_COPS_Assignment module */
			let url = app.api.buildURL("COPSAssignment", null, null, {
			  filter: [
				{
				  criteria_for_auto_assignment_c: criteria,
				  product_c: product,
				  region_c: region,
				  cpuFunction: cpuFunction,
				  APIFlag: "servicetaskAPI",
				},
			  ],
			});
			app.api.call(
			  "read",
			  url,
			  null,
			  {
				success: _.bind(function (response) {
				  /* Get group user id */
				  if (response.code == 200 && response.record.group_user_id) {
					let groupUserId = response.record.group_user_id;
									
					
							/* Set group user */
							self.model.set("assigned_user_id", groupUserId);
							self.model.set("send_to_cpu_flag_c", true);
							//self.model.save();
							//Loader
							app.alert.show("massexport_loading", {
								level: "process",
								title: app.lang.get("LBL_LOADING"),
							  });
							// Save the model to the server
							self.model.save(null, {
								success: function(model, response) {
									//removed loader
									app.alert.dismiss("massexport_loading");
									app.alert.show("message-id", {
										level: "success",
										messages: "The service task has been assigned successfully",
										autoClose: true,
									});
								},
							});
							
					
				  } else {
					console.log("No Unit/group user name found for send to CPU");
					app.alert.show("message-id", {
						level: "error",
						title: "error",
						messages:
						  "The service task assignment has been failed",
						autoClose: false,
					  });
				  }
				}, this),
				error: _.bind(function (error) {
				  // here is your error code
				  console.log("Error", error);
				}, this),
			  },
			  { async: false }
			);
		  }		
	},
	  
	//Call function after click on Rerout to creator button and update assigned to is Creator of service task record  
	rerouteToCreatorButton: function () {		
		let self = this;
		let createdUser = self.model.get("created_by");
		self.model.set("assigned_user_id", createdUser);
		self.model.set("reroute_to_creator_flag_c", true);
		//self.model.save();
		//Loader
		app.alert.show("massexport_loading", {
			level: "process",
			title: app.lang.get("LBL_LOADING"),
		  });
		// Save the model to the server
        self.model.save(null, {
            success: function(model, response) {
				//removed loader
				app.alert.dismiss("massexport_loading");
                app.alert.show("message-id", {
					level: "success",
					messages: "The service task has been assigned successfully",
					autoClose: true,
				});
            },
        });		
	},  
		  
	//Restrict backspace key when click on Attachment field.
	disableBackspace: function (e) {
		if (e.which == 8) {
				$('.select2-search-choice').removeClass("select2-search-choice-focus");
			e.preventDefault();
		}
	},
	/* Click edit action and refresh page then attachments apply validations as per conditions */
	setAttachmentDeleteValidation: function(){
		let userRole = app.user.get("roles");		
		let assignedUserId = this.model.get('assigned_user_id');
		let loggedInUserId = app.user.get('id');
		let serviceStatus = this.model.get('status_c');
		let casesStatus = this.model.get('cases_status_c');
		let attachmentField = this.model.get('attachment_list');
		let notesArray ={};
		$.each( attachmentField.models, function(key, value) {
			notesArray[attachmentField.models[key].id] = attachmentField.models[key].attributes.created_by;			
		});
		setTimeout(() => {
			/* Add attachment restrict based on below conditions:
			-If Service Task Status == Completed and does not belong to Customer Service Supervisor Role and linked cases status is not closed or closed*/				
			if(app.user.get("type") != "admin" && serviceStatus=='Completed' && !userRole.includes("Customer Service Supervisor") && (casesStatus!='Closed' || casesStatus=='Closed')){
				$("input[name='attachment_list']").attr("disabled", true);
			}
			/* Remove/delete attachment restrict based on below conditions:
			-Logged in user = Owner of File A and Logged in user ? Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status ? Completed
			-Logged in user ? Owner of File A and Logged in user = Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status ? Completed
			-Logged in user ? Owner of File A and Logged in user ? Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status ? Completed
			-Logged in user = Owner of File A and Logged in user = Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status = Completed
			-Logged in user = Owner of File A and Logged in user ? Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status = Completed
			-Logged in user ? Owner of File A and Logged in user = Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status = Completed
			-Logged in user ? Owner of File A and Logged in user ? Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status = Completed
			*/
			$('.multi-attachments-detail-view ul li div span a.multi-attachment-link').each(function(i)
			{
				let self_c = this;
				let url = $(self_c).attr('href'); // This is your rel value
				if (url) {
					let  noteId = url.split('/')[3];
					let  ownerId = notesArray[noteId];
	 
					let isAdmin = app.user.get("type") === "admin";
					
					let isOwnerLoggedInUser = loggedInUserId === ownerId && loggedInUserId !== assignedUserId && !userRole.includes("Customer Service Supervisor") && casesStatus != 'Closed' && serviceStatus != 'Completed';
					
					let isOwnerNotLoggedInUser = loggedInUserId !== ownerId && loggedInUserId === assignedUserId && !userRole.includes("Customer Service Supervisor") && casesStatus != 'Closed' && serviceStatus != 'Completed';
					
					let isAssignNotLoggedInUser = loggedInUserId !== ownerId && loggedInUserId !== assignedUserId && !userRole.includes("Customer Service Supervisor") && casesStatus != 'Closed' && serviceStatus != 'Completed';
					
					let isOwnerLoggedInStatusCompleted = loggedInUserId === ownerId && loggedInUserId === assignedUserId && !userRole.includes("Customer Service Supervisor") && casesStatus != 'Closed' && serviceStatus == 'Completed';
					
					let isAssignNotLoggedInStatusCompleted = loggedInUserId === ownerId && loggedInUserId !== assignedUserId && !userRole.includes("Customer Service Supervisor") && casesStatus != 'Closed' && serviceStatus == 'Completed';
					
					let isOwnerNotLoggedInStatusCompleted = loggedInUserId !== ownerId && loggedInUserId === assignedUserId && !userRole.includes("Customer Service Supervisor") && casesStatus != 'Closed' && serviceStatus == 'Completed';
					
					let isOwnerAssignedNotStatusCompleted = loggedInUserId !== ownerId && loggedInUserId !== assignedUserId && !userRole.includes("Customer Service Supervisor") && casesStatus != 'Closed' && serviceStatus == 'Completed';
					
					if (!isAdmin && (isOwnerLoggedInUser || isOwnerNotLoggedInUser || isAssignNotLoggedInUser || isOwnerLoggedInStatusCompleted || 
					isAssignNotLoggedInStatusCompleted || isOwnerNotLoggedInStatusCompleted || isOwnerAssignedNotStatusCompleted)) {
						$(self_c).parents('span').parents('div').nextAll("a").hide();
					}				
				}
			});
		}, 100);
	},
	
	onloadView: function(){
		$('.record-edit-link-wrapper').remove(); //remove pencil icon
		this.getAssignedUserDept();
		/* Click edit action and refresh page then attachments apply validations as per conditions */
		if(this.action =='edit'){
			this.setAttachmentDeleteValidation();
		}
	},
	setTagReadOnly: function(){		
		var get_val = $('span [data-fieldname="assigned_user_name"] span').attr("class");
		if(get_val=='disabled detail' || get_val=='detail disabled' || get_val=='edit disabled'){
		  $('div [data-name="tag"]').attr("readonly","true");
		  $("div [data-name='tag']").css("pointer-events","none");
		}else{
		  $('div [data-name="tag"]').attr("readonly","false");
		  $("div [data-name='tag']").css("pointer-events","block");
		}
		
		var self =this;		
	},
	setUserName: function(){
		this.hide_show_fields();
		var self =this;
		sessionStorage.setItem('old_task_user'+self.model.get("id"),'');
		var assigned_user_name = self.model.get('assigned_user_name');
		sessionStorage.setItem('old_task_user'+self.model.get("id"),assigned_user_name);
	},
	hide_show_fields: function() {
		var self = this;
		self.$('div[data-name="recommendation_by_io_c"]').hide();
		var assigned_user_name = self.model.get('assigned_user_name');
		if(sessionStorage.getItem('old_task_user'+self.model.get("id")) != assigned_user_name && assigned_user_name !='CS Internal Ombudsman' ){
				
				self.model.set('recommendation_by_io_c','');
		}
		if(assigned_user_name=='CS Internal Ombudsman'){
			
			self.$('div[data-name="recommendation_by_io_c"]').show();
			
			self.model.addValidationTask('recommendation_by_io_c', _.bind(this._doValidateCustom, this));
			
		}
		self.resolutionFieldValidation(); //CR 76 resolution_c validation
	},
	_doValidateCustom: function(fields, errors, callback) {
		if (_.isEmpty(this.model.get('recommendation_by_io_c')) && this.model.get('assigned_user_name')=='CS Internal Ombudsman')
		{
			errors['recommendation_by_io_c'] = errors['recommendation_by_io_c'] || {};
			errors['recommendation_by_io_c'].required = true;
		}

        callback(null, fields, errors);
    },
	_OnCaseChange: function() {
		
		var self = this;
		var caseID = self.model.get('cases_st_service_tasks_1cases_ida');
		if(caseID!="" && caseID!=undefined){
			
			var CasesBean = SUGAR.App.data.createBean('Cases', {id:caseID}); 
			CasesBean.fetch({'success':function () {
				//Get case value
				area_c = CasesBean.get('area_c');
				category_c = CasesBean.get('category_c');
				sub_category_c = CasesBean.get('sub_category_c');
				console.log("Test");
				//if case is closed then tag fields none editable
				get_status = CasesBean.get('status');
				let is_capa_flag = false;
				if(get_status=='Closed'){
					//to set flag for CAPA field visibility based on linked case status
					is_capa_flag = true;
				  $('div [data-name="tag"]').attr("readonly","true");
				  $("div [data-name='tag']").css("pointer-events","none");
					$('div [data-name="attachment_list"]').attr("readonly", "true");
				  $("div [data-name='attachment_list']").css("pointer-events", "none");
				}else{
				  $('div [data-name="tag"]').attr("readonly","false");
				  $("div [data-name='tag']").css("pointer-events","block");
					$('div [data-name="attachment_list"]').attr("readonly", "false");
				  $("div [data-name='attachment_list']").css("pointer-events", "");
				}
				//End code here
				self.model.set("is_CAPA_visibility_flag_c",is_capa_flag);
				
				//Set service task value
				self.model.set("area_c",area_c);
				self.model.set("category_c",category_c);
				self.model.set("sub_category_c",sub_category_c);
				//self.acsValidation();
			},
			error:function(e){
					//No action required
			}
			});
		}
    },
	/**
     * Event handler for click event.
     */
    editClicked: function() {
		/* defult code here */
        this.setButtonStates(this.STATE.EDIT);
        this.cancelButtonClicked = false;
        this.action = 'edit';
        this.toggleEdit(true);
        this.setRoute('edit');
		/* end here below custome code */
		var self = this;
		sessionStorage.setItem('st_cancel_record'+self.model.get("id"),'');
		sessionStorage.setItem('st_category_c_old'+self.model.get("id"),self.model.get('category_c')); //Use when click on cancel button
		sessionStorage.setItem('st_sub_category_c_old'+self.model.get("id"),self.model.get('sub_category_c')); //Use when click on cancel button
		
		let userRole = app.user.get("roles");		
		let assignedUserId = this.model.get('assigned_user_id');
		let loggedInUserId = app.user.get('id');
		let serviceStatus = this.model.get('status_c');
		let casesStatus = this.model.get('cases_status_c');
		let attachmentField = this.model.get('attachment_list');
		let notesArray ={};
		$.each( attachmentField.models, function(key, value) {
			notesArray[attachmentField.models[key].id] = attachmentField.models[key].attributes.created_by;			
		});
		setTimeout(() => {
			/* Add attachment restrict based on below conditions:
			-If Service Task Status == Completed and does not belong to Customer Service Supervisor Role and linked cases status is not closed or closed*/	
			if(casesStatus=='Closed'){
				$('div [data-name="attachment_list"]').attr("readonly", "true");
				$("div [data-name='attachment_list']").css("pointer-events", "none");
			}else{
				$('div [data-name="attachment_list"]').attr("readonly", "false");
				$("div [data-name='attachment_list']").css("pointer-events", "");
			}		
			if(app.user.get("type") != "admin" && serviceStatus=='Completed' && !userRole.includes("Customer Service Supervisor") && (casesStatus!='Closed' || casesStatus=='Closed')){
				$("input[name='attachment_list']").attr("disabled", true);
			}
			/* Remove/delete attachment restrict based on below conditions:
			-Logged in user = Owner of File A and Logged in user ? Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status ? Completed
			-Logged in user ? Owner of File A and Logged in user = Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status ? Completed
			-Logged in user ? Owner of File A and Logged in user ? Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status ? Completed
			-Logged in user = Owner of File A and Logged in user = Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status = Completed
			-Logged in user = Owner of File A and Logged in user ? Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status = Completed
			-Logged in user ? Owner of File A and Logged in user = Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status = Completed
			-Logged in user ? Owner of File A and Logged in user ? Assigned to and Logged in user role ? Customer Service Supervisor and Case Status ? Closed and Service Task Status = Completed
			*/
			$('.multi-attachments-detail-view ul li div span a.multi-attachment-link').each(function(i)
			{
				let self_c = this;
				let url = $(self_c).attr('href'); // This is your rel value
				if (url) {
					let  noteId = url.split('/')[3];
					let  ownerId = notesArray[noteId];
	 
					let isAdmin = app.user.get("type") === "admin";
					
					let isOwnerLoggedInUser = loggedInUserId === ownerId && loggedInUserId !== assignedUserId && !userRole.includes("Customer Service Supervisor") && casesStatus != 'Closed' && serviceStatus != 'Completed';
					
					let isOwnerNotLoggedInUser = loggedInUserId !== ownerId && loggedInUserId === assignedUserId && !userRole.includes("Customer Service Supervisor") && casesStatus != 'Closed' && serviceStatus != 'Completed';
					
					let isAssignNotLoggedInUser = loggedInUserId !== ownerId && loggedInUserId !== assignedUserId && !userRole.includes("Customer Service Supervisor") && casesStatus != 'Closed' && serviceStatus != 'Completed';
					
					let isOwnerLoggedInStatusCompleted = loggedInUserId === ownerId && loggedInUserId === assignedUserId && !userRole.includes("Customer Service Supervisor") && casesStatus != 'Closed' && serviceStatus == 'Completed';
					
					let isAssignNotLoggedInStatusCompleted = loggedInUserId === ownerId && loggedInUserId !== assignedUserId && !userRole.includes("Customer Service Supervisor") && casesStatus != 'Closed' && serviceStatus == 'Completed';
					
					let isOwnerNotLoggedInStatusCompleted = loggedInUserId !== ownerId && loggedInUserId === assignedUserId && !userRole.includes("Customer Service Supervisor") && casesStatus != 'Closed' && serviceStatus == 'Completed';
					
					let isOwnerAssignedNotStatusCompleted = loggedInUserId !== ownerId && loggedInUserId !== assignedUserId && !userRole.includes("Customer Service Supervisor") && casesStatus != 'Closed' && serviceStatus == 'Completed';
					
					if (!isAdmin && (isOwnerLoggedInUser || isOwnerNotLoggedInUser || isAssignNotLoggedInUser || isOwnerLoggedInStatusCompleted || 
					isAssignNotLoggedInStatusCompleted || isOwnerNotLoggedInStatusCompleted || isOwnerAssignedNotStatusCompleted)) {
						$(self_c).parents('span').parents('div').nextAll("a").hide();
					}
					
					/* let isOwnerAssignedUser = ownerId && ownerId !== assignedUserId && loggedInUserId === assignedUserId;
					let isNotOwnerAndNotSupervisor = ownerId !== loggedInUserId && !userRole.includes("Customer Service Supervisor");
	 
					if (!isAdmin && (isOwnerAssignedUser || isNotOwnerAndNotSupervisor)) {
						$(self_c).parents('span').parents('div').nextAll("a").hide();
					} */
				}
			});
		}, 100);
		
		self.resolutionFieldValidation(); //CR 76 resolution_c validation
    },
	cancelClicked: function() {
		var self = this;
		/* defult code here */
        app.alert.dismiss('cancel-dropdown-view-change');
        this.setButtonStates(this.STATE.VIEW);
        this.cancelButtonClicked = true;
        this.action = 'detail';
        this.handleCancel();
        this.clearValidationErrors(this.editableFields);
        this.setRoute();
        this.unsetContextAction();

        if (typeof this.cancelCallback === 'function') {
            this.cancelCallback();
        }
		$('div [data-name="attachment_list"]').attr("readonly", "false");
		$("div [data-name='attachment_list']").css("pointer-events", "");
		/* end here */
		/* Render ACS value after cancel button */
		var area_c = self.model.get('area_c');
		sessionStorage.setItem('st_cancel_record'+self.model.get("id"),'yes');
		setTimeout(() => {
			/* Set area,category,stage,status dropdown values after cancel button click */
			self.model.set('area_c','');
			self.model.set('area_c',area_c);
			self.model.set('category_c','');
			self.model.set('category_c',sessionStorage.getItem('st_category_c_old'+self.model.get("id")));			
		    /* This sessionStorage value used in enum.js to render dropdown values */
			sessionStorage.setItem('st_category_c_old'+self.model.get("id"),''); 
			sessionStorage.setItem('sub_category_c_old'+self.model.get("id"),''); 
			
		}, 600);
    },
	/**
     * CR 76 - Resolution field - Editable only if the logged in user is equal to the Assigned to of the service task record.
	 * Resolution - mandatory when Status is selected as ‘Completed’ and if the logged in user is equal to the Assigned to of the service task record 
     */ 
	resolutionFieldValidation: function () {
		self = this; 
		var user_role = app.user.get('roles');
		var currentUserId = app.user.get('id'); //current loggedin user
		var assignedUserId = self.model.get('assigned_user_id'); //record assigned_user_id
		if (!user_role.includes('Customer Service Supervisor')) {
			// Set required validation
			if ( currentUserId == assignedUserId && self.model.get('status_c') == 'Completed' ) {
				self.model.addValidationTask('resolution_c', _.bind(this._setResolutionFieldRequiredValidation, this));
			}
			
			// Set readonly validation
			if ( currentUserId != assignedUserId) {
				$('div [data-name="resolution_c"]').attr("readonly", "true");
				//$("div [data-name='resolution_c']").css("pointer-events", "none");
				setTimeout(function () {
					$("textarea[name='resolution_c']").attr('readonly', true);
				}, 500);
				
			}
		}
	},
	/*
		Set required validation on resolution
	*/
	_setResolutionFieldRequiredValidation: function(fields, errors, callback) {
		if (_.isEmpty(this.model.get('resolution_c')))
		{
			errors['resolution_c'] = errors['resolution_c'] || {};
			errors['resolution_c'].required = true;
		}

        callback(null, fields, errors);
    },
	/**
     * Handler for intent to edit. This handler is called both as a callback
     * from click events, and also triggered as part of tab focus event.
     *
     * @param {Event} e Event object (should be click event).
     * @param {jQuery} cell A jQuery node cell of the target node to edit.
     */
    handleEdit: function(e, cell) {
		
		/* Disable inline edit option for Service Task module - CR-76 */
		return false;
        var target,
            cellData,
            field;

        if (e) { // If result of click event, extract target and cell.
            target = this.$(e.target);
            cell = target.parents('.record-cell');
            // hide tooltip
            this.handleMouseLeave(e);
        }

        cellData = cell.data();
        field = this.getField(cellData.name);

        // If the focus drawer icon was clicked, open the focus drawer instead
        // of entering edit mode
        if (target && target.hasClass('focus-icon') && field && field.focusIconEnabled) {
            field.handleFocusClick();
            return;
        }

        // Set Editing mode to on.
        this.inlineEditMode = true;
        this.inlineEditModeFields.push(field.name);
        this.cancelButtonClicked = false;

        this.setButtonStates(this.STATE.EDIT);

        this.toggleField(field);

        if (this.$('.headerpane').length > 0) {
            this.toggleViewButtons(true);
            this.adjustHeaderpaneFields();
        }

        this.handleSugarLiveLinkButtonState(true);
    },
})