import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';
import BigNumber from 'bignumber.js';

const STATUS_CODES = [{
    value: 0,
    code: 'STATUS_CODE_UNKNOWN',
    message: 'Flight status is unknown'
  },{
    value: 10,
    code: 'STATUS_CODE_ON_TIME',
    message: 'Flight is on time'
  },{
    value: 20,
    code: 'STATUS_CODE_LATE_AIRLINE',
    message: 'Flight is delayed due to airline fault - payouts can be claimed'
  }
];
const AIRLINE_REGISTRATION_FEE = '10'; // Ether

export default class Contract {
  constructor(network, callback) {
    let config = Config[network];
    // AF - HttpProvider doesn't support subscribing to events in web3.js 1.0.0. - need to user WebsocketProvider
    this.web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
    this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
    this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
    this.initialize(callback);
    this.owner = null;
    this.airlines = [];
    this.passengers = [];
  }

  initialize(callback) {
    this.web3.eth.getAccounts((err, accounts) => {
      this.owner = accounts[0];
      let counter = 1;
      while (this.airlines.length < 5) {
        this.airlines.push(accounts[counter++]);
      }
      while (this.passengers.length < 5) {
        this.passengers.push(accounts[counter++]);
      }
      callback();
    });

    console.log('Listening for oracle\'s flight status verification...')
    this.flightSuretyApp.events.FlightStatusInfo({
      fromBlock: 0
    }, function (err, event) {
      if (err) {
        console.log(err.message)
      } else {
        $('#loading').hide();
        $('#oracle-response').show();
        let {index, airline, flight, timestamp, status} = event.returnValues;
        console.log('Flight status request for', index, flight, timestamp, 'verified:', Number(status));
        $('#status').text(STATUS_CODES.find(obj => obj.value === Number(status)).message);
      }
    });
  }

  async isOperational() {
    let self = this;
    console.log('Fetching contract\'s operational status...');
    try {
      let result = await this.flightSuretyApp.methods.isOperational()
        .call({ from: self.owner });
      $('#is-operational').text(result ? "Yes" : "No");
    } catch (err) {
      console.log(err.message)
    }
  }

  async payAirlineRegistrationFee() {
    let self = this;
    console.log('Paying registration fee for contract owner...');
    try {
      await this.flightSuretyApp.methods.payAirlineRegistrationFee()
        .send({ from: self.owner, value: self.web3.utils.toWei(AIRLINE_REGISTRATION_FEE) });
    } catch (err) {
      console.log(err.message)
    }
  }

  async registerFlight(flight, time) {
    let self = this;
    let payload = {
      flight: flight,
      timestamp: time,
      status: STATUS_CODES.find(status => status.code === 'STATUS_CODE_UNKNOWN').value
    }
    console.log('Registering flight: ', payload.flight, payload.timestamp);
    try {
      await this.flightSuretyApp.methods.registerFlight(payload.flight, payload.timestamp, payload.status)
        .send({ from: self.owner, gas: 6700000 });
    } catch (err) {
      console.log(err.message)
    }
  }

  async fetchFlightStatus(flight, time) {
    let self = this;
    let payload = {
      airline: self.owner,
      flight: flight,
      timestamp: time
    }
    console.log('Fetching flights status for: ', payload.flight, payload.timestamp);
    try {
      await this.flightSuretyApp.methods.fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
        .send({ from: self.passengers[0] });
    } catch (err) {
      console.log(err.message)
    }
  }

  async buyFlightInsurance(flight, time, payment) {
    let self = this;
    let ether = BigNumber(payment);
    let wei = self.web3.utils.toWei(ether.toFixed(), "ether");
    let payload = {
      airline: self.owner,
      flight: flight,
      timestamp: time,
      payment: wei
    }
    console.log('Buying flight insurance for: ', payload.airline, payload.flight, payload.timestamp);

    let initialBalance = this.web3.utils.fromWei(await this.web3.eth.getBalance(self.passengers[1]));
    console.log('Initial passenger balance: ', initialBalance);
    try {
      await this.flightSuretyApp.methods.buyFlightInsurance(payload.airline, payload.flight, payload.timestamp)
        .send({ from: this.passengers[1], value: payload.payment, gas: 6700000 });
    } catch (err) {
      console.log(err.message)
    }
    let finalBalance = this.web3.utils.fromWei(await this.web3.eth.getBalance(self.passengers[1]));
    console.log('Final passenger balance: ', finalBalance);
  }

  async pay(flight, time) {
    let self = this;
    let payload = {
      airline: self.owner,
      flight: flight,
      timestamp: time
    }
    console.log('Calling payout for: ', payload.airline, payload.flight, payload.timestamp);

    let initialBalance = this.web3.utils.fromWei(await this.web3.eth.getBalance(self.passengers[1]));
    console.log('Initial passenger balance: ', initialBalance);
    try {
      await this.flightSuretyData.methods.pay(payload.airline, payload.flight, payload.timestamp)
        .send({ from: self.passengers[1], value: payload.payment });
    } catch (err) {
      console.log(err.message)
    }
    let finalBalance = this.web3.utils.fromWei(await this.web3.eth.getBalance(self.passengers[1]));
    console.log('Final passenger balance: ', finalBalance);
  }
}