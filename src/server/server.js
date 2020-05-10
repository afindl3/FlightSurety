"use strict";

import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';
import fs from 'fs';

/********************************************************************************************/
/*                               SMART CONTRACT INTERACTIONS                                */
/********************************************************************************************/

let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);

const ORACLE_REGISTRATION_FEE = web3.utils.toWei('1');
const STATUS_CODES = [0, 10, 20]; // See flightsurety.js for code names. Reduced the number of available status's to reduce the average number of iterations until the minimum responses is obtained
const FLIGHT_CODES = ['AA_001', 'AC_014','CO_005']; // See flightsurety.js for code names
const NUMBER_OF_ORACLES = 25;
let oracles = [];
let accounts = [];

// Req 4.1 (Oracles): Oracles are implemented as a server app
// Req 4.2 (Oracles):	Upon startup, 20+ oracles are registered, and their assigned indexes are persisted in memory

// Need to spin up oracles, register them, persist their state in memory,
// or if you choose to write it to a file you don't have to re-register them every time
(async () => {
  accounts = await web3.eth.getAccounts();
  if (oracles.length == 0) {
    for (let i = 0; i < NUMBER_OF_ORACLES; i++) {
      console.log('1. Register oracle:', i)
      await flightSuretyApp.methods.registerOracle()
        .send({ from: accounts[i + 11], value: ORACLE_REGISTRATION_FEE, gas: 6700000 });

      // AF - This method also works as a means of getting the 'return value' of the registered oracles however emitting an event
      // on registration and listening for the event seems to be better practic
      // let indexes = await flightSuretyApp.methods.getMyIndexes().call({ from: accounts[i + 11], gas: 6700000 });
      // oracles.push({
      //   address: accounts[i + 11],
      //   indices: indexes
      // });
    }
  }
})();

flightSuretyApp.events.OracleRegistered({
  fromBlock: 0
}, function (err, event) {
  if (err) {
    console.log(err.message)
  } else {
    let {oracle, indexes} = event.returnValues;
    console.log('     Oracle registered with indexes:', indexes)
    oracles.push({
      address: oracle,
      indexes: indexes
    });
  }
});

flightSuretyApp.events.OracleRequest({
  fromBlock: 0
}, async function (err, event) {
  if (err) {
    console.log(err.message)
  } else {
    let {index, airline, flight, timestamp} = event.returnValues;
    console.log('\n2. Oracle index required to submit a response:', index);
    for (let i = 0; i < NUMBER_OF_ORACLES; i++) {
      if (oracles[i].indexes.includes(index)) {
        // Come up with the answer as to whether the flight is late or not, respond back by pushing a transaction to the smart contract
        let statusCode = STATUS_CODES[Math.floor(Math.random() * Math.floor(3))];
        console.log('     Oracle', i, 'submitting a response with status:', statusCode);
        try {
          await flightSuretyApp.methods.submitOracleResponse(index, airline, flight, timestamp, statusCode)
            .send({ from: oracles[i].address, gas: 6700000 });
        } catch(err) {
          if (err.message === "Returned error: VM Exception while processing transaction: revert Flight status has already been verified or airline/flight/timestamp do not match oracle request"){
            console.log('     Oracle', i, 'submission was rejected since flight status has already been verified by 3 oracles');
          } else {
            console.log(err.message)
          }
        }
      }
    }
  }
});

flightSuretyApp.events.FlightStatusInfo({
  fromBlock: 0
}, async function (err, event) {
  if (err) {
    console.log(err.message)
  } else {
    let {index, airline, flight, timestamp, status} = event.returnValues;
    console.log('3. Flight status for', index, flight, timestamp, 'verified:', status);
  }
});

/********************************************************************************************/
/*                                       FE INTERACTIONS                                    */
/********************************************************************************************/

const app = express();

app.get('/api', (req, res) => {
  res.send({
    message: 'An API for use with your Dapp!'
  })
});

// Endpoint that returns hardcoded flights and timestamps and hydrates a dropdown in the UI
app.get('/api/flights', (req, res) => {
  const currentTimestamp = Math.floor(Date.now() / 1000); 
  res.send([{
      flight: FLIGHT_CODES[0],
      times: [currentTimestamp + 60,  currentTimestamp + 3600, currentTimestamp + 86000]
    },
    {
      flight: FLIGHT_CODES[1],
      times: [currentTimestamp + 120,  currentTimestamp + 7200, currentTimestamp + 172000]
    },
    {
      flight: FLIGHT_CODES[2],
      times: [currentTimestamp + 180,  currentTimestamp + 10800, currentTimestamp + 258000]
    }
  ]);
});

export default app;





  // fs.readFile('./src/server/oracles.json', (err, data) => {
  //   if (err) console.log(err);
  //   if (data) {
  //     console.log("Oracles fetched from memory: ")
  //     oracles = JSON.parse(data);
  //     console.log(oracles);
  //   }
  // });

  // console.log('Writing oracle to memory...')
  // fs.writeFile('./src/server/oracles.json', JSON.stringify(oracle), (err, data) => {
  //   if(err) console.log(err);
  // });