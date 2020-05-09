
var Test = require('../config/testConfig.js');
// var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  const STATUS_CODES = {
    STATUS_CODE_UNKNOWN: 0,
    STATUS_CODE_ON_TIME: 10,
    STATUS_CODE_LATE_AIRLINE: 20,
    STATUS_CODE_LATE_WEATHER: 30,
    STATUS_CODE_LATE_TECHNICAL: 40,
    STATUS_CODE_LATE_OTHER: 50
  };
  const FLIGHT_CODES = {
    AA_001: "AA_001", // American Airlines
    AC_014: "AC_014", // Air Canada
    CO_005: "CO_005", // Continental Airlines
    DL_006: "DL_006" // Delta Airlines
  };
  const AIRLINE_REGISTRATION_FEE = web3.utils.toWei("10");
  const LIABILITY = 1.5;
  const TIMESTAMP = Math.floor(Date.now() / 1000) + 300; // Add 5 minutes to current unix timestamp

  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeContract(config.flightSuretyApp.address);
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  // it(`1. (multiparty) has correct initial isOperational() value`, async function () {
  //   // Get operating status
  //   let status = await config.flightSuretyData.isOperational.call();
  //   assert.equal(status, true, "Incorrect initial operating status value");
  // });

  // it(`2. (multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {
  //   // Ensure that access is denied for non-Contract Owner account
  //   let accessDenied = false;
  //   try {
  //     await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
  //   }
  //   catch(e) {
  //     accessDenied = true;
  //   }
  //   assert.equal(accessDenied, true, "Access not restricted to Contract Owner");   
  // });

  // it(`3. (multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {
  //   // Ensure that access is allowed for Contract Owner account
  //   let accessDenied = false;
  //   try {
  //     await config.flightSuretyData.setOperatingStatus(false);
  //   }
  //   catch(e) {
  //     accessDenied = true;
  //   }
  //   assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
  // });

  // it(`4. (multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {
  //     await config.flightSuretyData.setOperatingStatus(false);
  //     let reverted = false;
  //     try {
  //       await config.flightSurety.setTestingMode(true);
  //     }
  //     catch(e) {
  //       reverted = true;
  //     }
  //     assert.equal(reverted, true, "Access not blocked for requireIsOperational");      
  //     // Set it back for other tests to work
  //     await config.flightSuretyData.setOperatingStatus(true);
  // });

  it('5. (airline) contract owner can pay registration fee then register a new airline', async () => {
    // ARRANGE
    const owner = config.owner;
    const firstAirline = accounts[1];
    // ACT
    try {
      await config.flightSuretyApp.payAirlineRegistrationFee({from: owner, value: AIRLINE_REGISTRATION_FEE});
      await config.flightSuretyApp.registerAirline(firstAirline, {from: owner});
    }
    catch(e) {
      console.log(e)
    }
    const isOwnerRegistered = await config.flightSuretyData.isAirlineRegistered(owner);
    const hasOwnerPaidRegistraionFee = await config.flightSuretyData.hasAirlinePaidRegistraionFee(owner);
    const isFirstAirlineRegistered = await config.flightSuretyData.isAirlineRegistered(firstAirline);
    const hasFirstAirlinePaidRegistraionFee = await config.flightSuretyData.hasAirlinePaidRegistraionFee(firstAirline);

    // https://web3js.readthedocs.io/en/v1.2.0/web3-eth.html#getbalance
    // https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
    const contractBalance = web3.utils.fromWei(await web3.eth.getBalance(config.flightSuretyData.address));
    console.log('          Final data contract balance (ether): ' + contractBalance);

    // ASSERT
    assert.equal(isOwnerRegistered, true, "Contract owner should be registered");
    assert.equal(hasOwnerPaidRegistraionFee, true, "Contract owner should be funded");
    assert.equal(contractBalance, web3.utils.fromWei(AIRLINE_REGISTRATION_FEE), "Contract's balance should equal the registration fee paid");
    assert.equal(isFirstAirlineRegistered, true, "First airline should be registered");
    assert.equal(hasFirstAirlinePaidRegistraionFee, false, "First airline should not be funded");
  });

  it('6. (airline) contract owner can register a new flight', async () => {
    // ARRANGE
    const owner = config.owner;
    // ACT
    try {
      await config.flightSuretyApp.registerFlight(FLIGHT_CODES.AA_001, TIMESTAMP, STATUS_CODES.STATUS_CODE_ON_TIME, {from: owner});
    }
    catch(e) {
      console.log(e)
    }
    // ASSERT

  });

  it('7. (passenger) passenger can buy insurance and get paid out if airline is at fault for delay', async () => {
    // ARRANGE
    const airline = config.owner;
    const passenger = accounts[2];
    const premium = web3.utils.toWei("1");

    const initialPassengerBalance = web3.utils.fromWei(await web3.eth.getBalance(passenger));
    console.log('          Initial passenger balance (ether): ' + initialPassengerBalance);

    // ACT
    try {
      await config.flightSuretyApp.buyFlightInsurance(airline, FLIGHT_CODES.AA_001, TIMESTAMP, {from: passenger, value: premium});
      await config.flightSuretyApp.processFlightStatus(airline, FLIGHT_CODES.AA_001, TIMESTAMP, STATUS_CODES.STATUS_CODE_LATE_AIRLINE);      
      await config.flightSuretyData.pay(airline, FLIGHT_CODES.AA_001, TIMESTAMP, {from: passenger});
    }
    catch(e) {
      console.log(e)
    }

    const contractBalance = web3.utils.fromWei(await web3.eth.getBalance(config.flightSuretyData.address));
    console.log('          Final data contract balance (ether): ' + contractBalance);
    const finalPassengerBalance = web3.utils.fromWei(await web3.eth.getBalance(passenger));
    console.log('          Final passenger balance (ether): ' + finalPassengerBalance);

    // Round to nearest decimal place to negate the effects of gas
    const finalBalance = Math.round(finalPassengerBalance * 10) / 10
    const expectedFinalBalance = Math.round(initialPassengerBalance * 10) / 10 - web3.utils.fromWei(premium)*(1 - LIABILITY);

    // ASSERT
    assert.equal(finalBalance, expectedFinalBalance, "Passenger should have received a payout based on premium paid and airline's assumed liability");
  });

});
