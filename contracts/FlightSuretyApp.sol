pragma solidity ^0.4.25;

// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

/************************************************** */
/* FlightSurety Smart Contract                      */
/************************************************** */
contract FlightSuretyApp {
  using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

  /********************************************************************************************/
  /*                                       DATA VARIABLES                                     */
  /********************************************************************************************/

    // Flight status codees
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner;          // Account used to deploy contract

    struct Flight {
      bool isRegistered;
      uint8 statusCode;
      uint256 updatedTimestamp;        
      address airline;
      mapping(address => bool) insuredPassengers;
    }
    // flightKey = hash(airline, flight, timestamp)
    mapping(bytes32 => Flight) private flights;

    FlightSuretyData flightSuretyData;  // AF
    mapping(address => address[]) private airlineRegistrationVotes; // AF
    uint256 public constant M = 50; // AF
    uint256 public constant AIRLINE_REGISTRATION_FEE = 10 ether; // AF
    uint256 public constant MAX_PURCHASE= 1 ether; // AF
    uint256[2] public LIABILITY = [3, 2]; // AF - cannot be a constant

  /********************************************************************************************/
  /*                                       FUNCTION MODIFIERS                                 */
  /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in 
    *      the event there is an issue that needs to be fixed
    */
    modifier requireIsOperational() {
      // require(true, "Contract is currently not operational"); // Modify to call data contract's status
      require(flightSuretyData.isOperational(), "Contract is currently not operational"); // AF
      _;  // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner() {
      require(msg.sender == contractOwner, "Caller is not contract owner");
      _;
    }

  /********************************************************************************************/
  /*                                       CONSTRUCTOR                                        */
  /********************************************************************************************/

    /**
    * @dev Contract constructor
    */
    // constructor() public {
    constructor(address dataContract) public { // AF
      contractOwner = msg.sender;
      flightSuretyData = FlightSuretyData(dataContract); // AF
    }

  /********************************************************************************************/
  /*                                       UTILITY FUNCTIONS                                  */
  /********************************************************************************************/

    function isOperational() public view returns(bool) {
      // return true;  // Modify to call data contract's status
      return flightSuretyData.isOperational(); // AF
    }

  /********************************************************************************************/
  /*                                     SMART CONTRACT FUNCTIONS                             */
  /********************************************************************************************/

    /**
    * @dev Add an airline to the registration queue
    */   
    function registerAirline(address newAirline) external returns(bool success, uint256 votes) {
      require(flightSuretyData.hasAirlinePaidRegistraionFee(msg.sender),
        "Caller must be registered & have paid registration fee in order to register another airline");
      require(!flightSuretyData.isAirlineRegistered(newAirline),
        "Airline the caller is attempting to register is already registered");

      bool isSuccess = false;
      uint256 numberOfRegisteredAirlines = flightSuretyData.getNumberOfRegisteredAirlines();
      
      if (numberOfRegisteredAirlines <= 4) {
        // Req 2.2 (Airlines): Only existing airline may register a new airline until there are at least 4 airlines registered
        flightSuretyData.registerAirline(newAirline);
        isSuccess = true;
      } else {
        // Req 2.3 (Airlines):	Registration of 5th and subsequent airline requires multi-part consensus of 50% of registered airline
        bool isDuplicate = false;
        for(uint i = 0; i < airlineRegistrationVotes[newAirline].length; i++) {
          if (airlineRegistrationVotes[newAirline][i] == msg.sender) {
            isDuplicate = true;
            break;
          }
        }
        require(!isDuplicate,
          "Caller has already voted to register this airline");

        airlineRegistrationVotes[newAirline].push(msg.sender);
        if (airlineRegistrationVotes[newAirline].length >= M.mul(numberOfRegisteredAirlines).div(100)) {
          flightSuretyData.registerAirline(newAirline);
          isSuccess = true;
        }
      }

      return(isSuccess, airlineRegistrationVotes[newAirline].length);
    }

    function payAirlineRegistrationFee() external payable {
      // Req 2.4 (Airlines):	Airline can be registered, but does not participate in contract until it submits funding of 10 ether
      require(flightSuretyData.isAirlineRegistered(msg.sender),
        "Airline's registration must first be accepted before paying the registration fee");
      require(!flightSuretyData.hasAirlinePaidRegistraionFee(msg.sender),
        "Airline has already paid the required amount");
      require(msg.value >= AIRLINE_REGISTRATION_FEE,
        "Registration fee paid is not sufficient");

      flightSuretyData.fund.value(AIRLINE_REGISTRATION_FEE)();
      flightSuretyData.payAirlineRegistrationFee(msg.sender, AIRLINE_REGISTRATION_FEE);

      uint amountToReturn = msg.value.sub(AIRLINE_REGISTRATION_FEE); // From project 6 - should be safewithdraw?
      msg.sender.transfer(amountToReturn);
    }

    function buyFlightInsurance(address airline, string flight, uint256 timestamp) external payable {
      // Req 3.1 (Passengers): Passengers may pay up to 1 ether for purchasing flight insurance
      require(msg.value <= MAX_PURCHASE,
        "Cannot be insured for this amount - too high");
      bytes32 flightKey = getFlightKey(airline, flight, timestamp);
      require(flights[flightKey].isRegistered == true,
        "Flight must be registered in order to purchase insurance");
      require(timestamp > block.timestamp,
        "Cannot purchase insurance for a flight in the past");
      // Upgrade - should allow passengers to continue to add finds until the 1 ether maximum is hit
      require(!flights[flightKey].insuredPassengers[msg.sender], 
        "Passenger has already purchased insurance for this flight");
      
      flights[flightKey].insuredPassengers[msg.sender] == true;
      // https://ethereum.stackexchange.com/questions/15953/send-ethers-from-one-contract-to-another
      flightSuretyData.buy.value(msg.value)(airline, flight, timestamp, msg.sender);
    }

    /**
    * @dev Register a future flight for insuring.
    */  
    function registerFlight(string flight, uint256 timestamp, uint8 statusCode) external {
      require(flightSuretyData.hasAirlinePaidRegistraionFee(msg.sender),
        "Airline must be registered & have paid registration fee in order to register a flight");
      bytes32 flightKey = getFlightKey(msg.sender, flight, timestamp);
      require(!flights[flightKey].isRegistered,
        "This flight has already been registered - cannot overwrite");
      require(timestamp > block.timestamp,
        "Cannot register a flight in the past");

      flights[flightKey] = Flight({
        isRegistered: true,
        statusCode: statusCode,
        updatedTimestamp: timestamp,
        airline: msg.sender
      });
    }
    
    /**
    * @dev Called after flight status has been verified by oracles
    */  
    // Should be internal - made public for unit testing
    function processFlightStatus(address airline, string memory flight, uint256 timestamp, uint8 statusCode) public {
      bytes32 flightKey = getFlightKey(airline, flight, timestamp);
      flights[flightKey].statusCode = statusCode;

      if (statusCode == STATUS_CODE_LATE_AIRLINE) {
        // Req 3.3 (Passengers): If flight is delayed due to airline fault, passenger receives
        // credit of 1.5X the amount the paid
        flightSuretyData.creditInsurees(airline, flight, timestamp, LIABILITY);
      }
    }

    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(address airline, string flight, uint256 timestamp) external {
      uint8 index = getRandomIndex(msg.sender);

      // Generate a unique key for storing the request
      bytes32 oracleKey = keccak256(abi.encodePacked(index, airline, flight, timestamp));
      oracleResponses[oracleKey] = ResponseInfo({
        requester: msg.sender,
        isOpen: true
      });

      // Req 4.3(Oracles): Client Dapp is used to trigger request to update flight status
      // generating OracleRequest event that is captured by server
      emit OracleRequest(index, airline, flight, timestamp);
    } 

  /********************************************************************************************/
  /*                                     ORACLE MANAGEMENT                                    */
  /********************************************************************************************/

    uint8 private nonce = 0; // Incremented to add pseudo-randomness at various points 
    uint256 public constant ORACLE_REGISTRATION_FEE = 1 ether; // Fee to be paid when registering oracle
    uint256 private constant MIN_RESPONSES = 3; // Number of oracles that must respond for valid status
    
    struct Oracle {
      bool isRegistered;
      uint8[3] indexes;        
    }
    mapping(address => Oracle) private oracles; // Track all registered oracles

    // Model for responses from oracles
    struct ResponseInfo {
      address requester;                              // Account that requested status
      bool isOpen;                                    // If open, oracle responses are accepted
      mapping(uint8 => address[]) responses;          // Mapping key is the status code reported
                                                        // This lets us group responses and identify
                                                        // the response that majority of the oracles
    }
    mapping(bytes32 => ResponseInfo) private oracleResponses; // Track all oracle responses. oracleKey = hash(index, airline, flight, timestamp)

    // Event fires when oracle is registered
    event OracleRegistered(address oracle, uint8[3] indexes);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index they fetch data and submit a response
    event OracleRequest(uint8 index, address airline, string flight, uint256 timestamp);

    // Event fired each time an oracle submits a response
    event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when status is verified
    event FlightStatusInfo(address airline, string flight, uint256 timestamp, uint8 status);

    // Register an oracle with the contract
    function registerOracle() external payable {
      require(msg.value >= ORACLE_REGISTRATION_FEE,
        "Registration fee is required");

      // Generate three random indexes (range 0-9) using generateIndexes for the calling oracle
      uint8[3] memory indexes = generateIndexes(msg.sender);

      oracles[msg.sender] = Oracle({
        isRegistered: true,
        indexes: indexes
      });

      emit OracleRegistered(msg.sender, indexes);
    }

    function getMyIndexes() view external returns(uint8[3]) {
      require(oracles[msg.sender].isRegistered,
        "Not registered as an oracle");

      return oracles[msg.sender].indexes;
    }

    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open and matches one of the three Indexes 
    // randomly assigned to the oracle at the time of registration (i.e. uninvited oracles are not welcome)
    function submitOracleResponse(uint8 index, address airline, string flight, uint256 timestamp, uint8 statusCode) external {
      // require(oracles[msg.sender].isRegistered == true,
      //   "Oracle must be registered to submit a response"); // AF
      require((oracles[msg.sender].indexes[0] == index) || (oracles[msg.sender].indexes[1] == index) || (oracles[msg.sender].indexes[2] == index),
        "Index does not match oracle request");
      bytes32 oracleKey = keccak256(abi.encodePacked(index, airline, flight, timestamp));
      require(oracleResponses[oracleKey].isOpen,
        "Flight status has already been verified or airline/flight/timestamp do not match oracle request");
      
      oracleResponses[oracleKey].responses[statusCode].push(msg.sender);
      emit OracleReport(airline, flight, timestamp, statusCode);

      // Information isn't considered verified until at least MIN_RESPONSES oracles respond with the same information
      if (oracleResponses[oracleKey].responses[statusCode].length >= MIN_RESPONSES) {
        // Prevent any more responses since MIN_RESPONSE threshold has been reached
        // oracleResponses[oracleKey].isOpen = false; // AF

        emit FlightStatusInfo(airline, flight, timestamp, statusCode);
        processFlightStatus(airline, flight, timestamp, statusCode); // Handle flight status as appropriate
      }
    }

    function getFlightKey(address airline, string flight, uint256 timestamp) pure internal returns(bytes32) {
      return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account) internal returns(uint8[3]) {
      uint8[3] memory indexes;
      indexes[0] = getRandomIndex(account);
      
      indexes[1] = indexes[0];
      while(indexes[1] == indexes[0]) {
        indexes[1] = getRandomIndex(account);
      }

      indexes[2] = indexes[1];
      while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
        indexes[2] = getRandomIndex(account);
      }

      return indexes;
    }

    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account) internal returns (uint8) {
      uint8 maxValue = 10;

      // Pseudo random number...the incrementing nonce adds variation
      uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

      if (nonce > 250) {
        nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
      }

      return random;
    }

}

// AF - Data contract interface
contract FlightSuretyData {
  function isOperational() public view returns(bool);
  function setOperatingStatus(bool mode) external;

  function registerAirline(address airline) public;
  function isAirlineRegistered(address airline) external view returns(bool);
  function getNumberOfRegisteredAirlines() external view returns(uint256);

  function payAirlineRegistrationFee(address airline, uint256 amountPaid) external;
  function hasAirlinePaidRegistraionFee(address airline) external view returns(bool);
  
  function buy(address airline, string flight, uint256 timestamp, address passenger) external payable;
  function creditInsurees(address airline, string flight, uint256 timestamp, uint256[2] liability) external;
  function fund() public payable;
}
