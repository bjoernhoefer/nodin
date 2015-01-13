device_settings ={}

function change_defaults(){
    if ( ($("#non_default_settings_div").attr("class")) == "hide"){
        $("#non_default_settings_div").removeClass('hide')
    }
    else
        $("#non_default_settings_div").addClass('hide')
    
}

function add_device(){
    if ( ($("#non_default_settings_div").attr("class")) == "hide"){
        $.post("/add_device", {defaults: true, device: $("#device").val() })
            .done(function(data){
                process_response(data)
            })
    }
    else{
        device_settings = {defaults: false}
        $('#add_device input[type=text].form-control').each(function (i) {
            device_settings[$(this).attr('id')] = ($(this).val())
        })
        $.post("/add_device", device_settings)
            .done(function(data){
                process_response(data)
            })
    }
}

function process_response(data){
    if (data == "ok"){
        alert("All OK")
    }
    else if (data == "lookup") {
        alert("Device lookup failed - please check hostname again!")
    }
    else if (data == "file") {
        alert("Writing config file failed - no problem, till you restart nOdin...")
    }
    else if (data == "duplicate") {
        alert("Host is already added to nOdin!")
    }
    else{
        alert("An unknown status was received: "+data)
    }
}