
import Contract from './contract';
import './flightsurety.css';
import axios from "axios";

let flightTimesResponse;

(async () => {
  axios.get('/api/flights').then((result) => {
    flightTimesResponse = result.data;
    console.log(flightTimesResponse);
    flightTimesResponse.forEach((element) => {
      populateFlights(element);
    });
  });

  let contract = new Contract('localhost', () => {
    contract.isOperational();

    contract.payAirlineRegistrationFee();

    flightTimesResponse.forEach((flightTimes) => {
      flightTimes.times.forEach((time) => {
        contract.registerFlight(flightTimes.flight, time);
      });
    });

    $('#submit-oracle').click(() => {
      let flight = $('#flights-status').val();
      let time = $('#times-status').val();
      $('#loading').show();
      contract.fetchFlightStatus(flight, time);
    });

    $('#submit-purchase').click(() => {
      let flight = $('#flights-purchase').val();
      let time = $('#times-purchase').val();
      let payment = $('#payment').val();
      contract.buyFlightInsurance(flight, time, payment);
    });

    $('#submit-payout').click(() => {
      let flight = $('#flights-payout').val();
      let time = $('#times-payout').val();
      contract.pay(flight, time);
    });

  });
})();

/********************************************************************************************/
/*                                     DOM MANIPULATION                                     */
/********************************************************************************************/

// Create dropdowns
let flightsStatusDropdown = $('#flights-status');
  flightsStatusDropdown.append('<option selected="true" disabled>Select a flight</option>');
  flightsStatusDropdown.prop('selectedIndex', 0);
let timesStatusDropdown = $('#times-status');
  timesStatusDropdown.append('<option selected="true" disabled>Select a time</option>');
  timesStatusDropdown.prop('selectedIndex', 0);
let flightsPurchaseDropdown = $('#flights-purchase');
  flightsPurchaseDropdown.append('<option selected="true" disabled>Select a flight</option>');
  flightsPurchaseDropdown.prop('selectedIndex', 0);
let timesPurchaseDropdown = $('#times-purchase');
  timesPurchaseDropdown.append('<option selected="true" disabled>Select a time</option>');
  timesPurchaseDropdown.prop('selectedIndex', 0);
let flightsPayoutDropdown = $('#flights-payout');
  flightsPayoutDropdown.append('<option selected="true" disabled>Select a flight</option>');
  flightsPayoutDropdown.prop('selectedIndex', 0);
let timesPayoutDropdown = $('#times-payout');
  timesPayoutDropdown.append('<option selected="true" disabled>Select a time</option>');
  timesPayoutDropdown.prop('selectedIndex', 0);

// Populate dropdown options
function populateFlights(data) {
  flightsStatusDropdown.append($('<option></option>').attr('value', data.flight).text(data.flight));
  flightsPurchaseDropdown.append($('<option></option>').attr('value', data.flight).text(data.flight));
  flightsPayoutDropdown.append($('<option></option>').attr('value', data.flight).text(data.flight));
}

// Add change event listeners
$('#flights-status').change(function(){
  timesStatusDropdown.empty();
  let times = flightTimesResponse.find(flightTimes => flightTimes.flight === $(this).val()).times;
  times.forEach((element) => {
    timesStatusDropdown.append($('<option></option>').attr('value', element).text(new Date(element * 1000))); 
  });
});
$('#flights-purchase').change(function(){
  timesPurchaseDropdown.empty();
  let times = flightTimesResponse.find(flightTimes => flightTimes.flight === $(this).val()).times;
  times.forEach((element) => {
    timesPurchaseDropdown.append($('<option></option>').attr('value', element).text(new Date(element * 1000))); 
  });
});
$('#flights-payout').change(function(){
  timesPayoutDropdown.empty();
  let times = flightTimesResponse.find(flightTimes => flightTimes.flight === $(this).val()).times;
  times.forEach((element) => {
    timesPayoutDropdown.append($('<option></option>').attr('value', element).text(new Date(element * 1000))); 
  });
});

// Add conditional rendering
$('#loading').hide();
$('#oracle-response').hide();















