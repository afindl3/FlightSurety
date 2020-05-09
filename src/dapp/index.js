
import Contract from './contract';
import './flightsurety.css';
import axios from "axios";

(async () => {
  fetchFlightsAndTimes();

  let contract = new Contract('localhost', () => {
    // Read transaction
    contract.isOperational((error, result) => {
      console.log('isOperational:')
      console.log(error)
      console.log(result)
      $('#is-operational').text(result ? "Yes" : "No");
    });

    // User-submitted transaction
    $('#submit-oracle').click(() => {
      // Write transaction
      let flight = $('#flights-dropdown').val();
      let time = $('#times-dropdown').val();
      contract.fetchFlightStatus(flight, time, (error, result) => {
        console.log('fetchFlightStatus:')
        console.log(error)
        console.log(result)
      });
    })
  });
})();

/********************************************************************************************/
/*                                     DOM MANIPULATION                                     */
/********************************************************************************************/

let flightTimesResponse;

function fetchFlightsAndTimes() {
  axios.get('/api/flights').then((result) => {
    flightTimesResponse = result.data;
    flightTimesResponse.forEach((element) => {
      flightsDropdown.append($('<option></option>').attr('value', element.flight).text(element.flight));
    })
  })
}

let flightsDropdown = $('#flights-dropdown');
flightsDropdown.empty();
flightsDropdown.append('<option selected="true" disabled>Select a flight</option>');
flightsDropdown.prop('selectedIndex', 0);

let timesDropdown = $('#times-dropdown');
timesDropdown.append('<option selected="true" disabled>Select a time</option>');
timesDropdown.prop('selectedIndex', 0);

$('#flights-dropdown').change(function(){
  timesDropdown.empty();
  let times = flightTimesResponse.find(flightTimes => flightTimes.flight === $(this).val()).times;
  times.forEach((element) => {
    timesDropdown.append($('<option></option>').attr('value', element).text(new Date(element * 1000))); 
  });
});







