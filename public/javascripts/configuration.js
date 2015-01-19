var defaults = {};

$(document).ready(function() {
    $(document).ready(function() {
        $( "button" ).attr('disabled', 'disabled');
        $('#configuration input[type=text].form-control').each(function (i) {
            defaults[$(this).attr('id')] = $(this).val()
        })
        
        $('#configuration input[type=text].form-control').keyup(function(){
            if ($(this).val() == defaults[$(this).attr('id')]){
                $( "button" ).attr('disabled', 'disabled');
            }
            else{
                $( "button" ).removeAttr( "disabled" )
            }
        })
    }) 
})

function save_configuration(){
    changed_config ={}
    i = 0
    $('#configuration input[type=text].form-control').each(function (i) {
        if ($(this).val() != defaults[$(this).attr('id')]){
            changed_config[$(this).attr('id')] = ($(this).val())
        }
        if ($('#configuration input[type=text].form-control').length-1 == i){
            $.post("configuration_change/"+$('ul.nav-tabs li.active').attr( "id"), changed_config)
                .done(function(data){
                    if (data == "set"){
                        alert("All OK")
                    }
                    else{
                        alert("An error occoured! " + data)
                    }
                })
        }
        else{
            i++
        }
    }) 
}

function change_active(tab){
    //alert(tab)
    activetab = $('ul.nav-tabs li.active').attr( "id")
    $('ul.nav-tabs li').each(function(){
        $("#"+[$(this).attr('id')]+"_values").removeClass("active")
        $("#"+[$(this).attr('id')]+"_values").addClass("hide")
    })
    $("#"+tab+"_values").removeClass("hide")
    $("#"+tab+"_values").addClass("active")
    $("#save_changes").attr("onclick",tab)
}