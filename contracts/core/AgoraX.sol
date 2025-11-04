// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";

// ========== WHITELIST ==========
abstract contract Whitelist is Ownable2Step {
    struct TokenInfo {
        address tokenAddress;
        bool isActive;
    }

    TokenInfo[] private whitelistedTokens;
    mapping(address => uint256) private tokenIndexes;

    event TokenWhitelisted(address indexed account);
    event TokenStatusChanged(address indexed account, bool isActive);

    /// @dev Whitelist a single token address
    /// @param _address Address to whitelist
    function addTokenAddress(address _address) external onlyOwner {
        if (_address == address(0) || tokenIndexes[_address] != 0) {
            return; // Skip zero address or already whitelisted
        }
        whitelistedTokens.push(TokenInfo(_address, true));
        tokenIndexes[_address] = whitelistedTokens.length;
        emit TokenWhitelisted(_address);
    }

    /// @dev Change the active status of a whitelisted token
    /// @param _address Token address
    /// @param _isActive New status
    function setTokenStatus(address _address, bool _isActive) external onlyOwner {
        uint256 index = tokenIndexes[_address];
        require(index > 0, "Whitelist: Address not found");

        uint256 realIndex = index - 1;
        require(realIndex < whitelistedTokens.length, "Whitelist: Index out of bounds");
        require(whitelistedTokens[realIndex].isActive != _isActive, "Whitelist: Status already set");

        whitelistedTokens[realIndex].isActive = _isActive;
        emit TokenStatusChanged(_address, _isActive);
    }

    /// @notice Checks if an address has been whitelisted
    /// @param _address Token address
    function isWhitelisted(address _address) public view returns (bool) {
        uint256 index = tokenIndexes[_address];
        return index > 0 && whitelistedTokens[index - 1].isActive;
    }

    /// @notice View total number of whitelisted tokens, both active and inactive
    function viewCountWhitelisted() public view returns (uint256) {
        return whitelistedTokens.length;
    }

    /// @notice Get token info at a specific index
    /// @param _index Index in whitelisted tokens array
    function getTokenInfoAt(uint256 _index) public view returns (address, bool) {
        require(_index < whitelistedTokens.length, "Whitelist: Invalid index");
        TokenInfo memory info = whitelistedTokens[_index];
        return (info.tokenAddress, info.isActive);
    }

    /// @notice Get whitelist index for a specific token
    /// @param _address Token address
    function getTokenWhitelistIndex(address _address) public view returns (uint256) {
        uint256 index = tokenIndexes[_address];
        require(index > 0, "Whitelist: Token not whitelisted");
        return index - 1; // 0-based array index
    }

    /// @notice View whitelisted tokens, both active and inactive
    /// @param cursor Cursor (should start at 0 for first request)
    /// @param size Size of the response
    function viewWhitelisted(uint256 cursor, uint256 size) external view returns (TokenInfo[] memory, uint256) {
        uint256 length = size;

        if (length > whitelistedTokens.length - cursor) {
            length = whitelistedTokens.length - cursor;
        }

        TokenInfo[] memory tokens = new TokenInfo[](length);

        for (uint256 i = 0; i < length; i++) {
            tokens[i] = whitelistedTokens[cursor + i];
        }

        return (tokens, cursor + length);
    }

    /// @notice View only whitelisted tokens that are active
    /// @param cursor Cursor (should start at 0 for first request)
    /// @param size Size of the response
    function viewActiveWhitelisted(uint256 cursor, uint256 size) external view returns (address[] memory, uint256) {
        uint256 activeCount = 0;
        uint256 end = cursor + size > whitelistedTokens.length ? whitelistedTokens.length : cursor + size;

        for (uint256 i = cursor; i < end; i++) {
            if (whitelistedTokens[i].isActive) {
                activeCount++;
            }
        }

        address[] memory activeTokens = new address[](activeCount);
        uint256 index = 0;

        for (uint256 i = cursor; i < end && index < activeCount; i++) {
            if (whitelistedTokens[i].isActive) {
                activeTokens[index] = whitelistedTokens[i].tokenAddress;
                index++;
            }
        }

        return (activeTokens, cursor + (end - cursor));
    }
}

// AgoraX is a limit order platform inspired by 0x and OTC contracts, written as an independent implementation.
// Not affiliated with or endorsed by any outside parties.

//  ________________                                                                           ________________
//  |              | ========================================================================= |              |
//   (@^,^,^,^,^,@)                                                                             (@^,^,^,^,^,@)
//     )`){o}(`(                                                                                  )`){o}(`(
//     ,`,`,`,`,`                                                       ____                      ,`,`,`,`,`
//     ==========            $$$$$$\                                   |$$ / $$\   $$\            ========== 
//      ||||||||            $$  __$$\                                  |$ /  $$ |  $$ |            ||||||||
//      ||||||||            $$ /  $$ | $$$$$$\   $$$$$$\   $$$$$$\  $$$$$$\  \$$\ $$  |            ||||||||
//      ||||||||            $$$$$$$$ |$$  __$$\ $$  __$$\ $$  __$$\ \____$$\  \$$$$  /             ||||||||
//      ||||||||            $$  __$$ |$$ /  $$ |$$ /  $$ |$$ |  \__|$$$$$$$ | $$  $$<              ||||||||
//      ||||||||            $$ |  $$ |$$ |  $$ |$$ |  $$ |$$ |     $$  __$$ |$$  /\$$\             ||||||||
//      ||||||||            $$ |  $$ |\$$$$$$$ |\$$$$$$  |$$ |     \$$$$$$$ |$$ /  $$ |            ||||||||
//      ||||||||            \__|  \__| \____$$ | \______/ \__|      \_______|\__|  \__|            ||||||||
//      ||||||||                      $$\   $$ |                                                   ||||||||
//     ,________,                     \$$$$$$  |                                                  ,________, 
//       )    (                        \______/                                                     )    ( 
//     ,       `                                                                                  ,       `
//   _/__________\_                                                                             _/__________\_
//  |______________| ========================================================================= |______________|
//  

contract AgoraX is Ownable2Step, ERC20, ReentrancyGuard, Whitelist {
    using SafeERC20 for IERC20;

    enum OrderStatus {
        Active,
        Cancelled,
        Completed
    }

    struct OrderDetails {
        address sellToken;
        uint256 sellAmount;
        uint256[] buyTokensIndex;
        uint256[] buyAmounts;
        uint256 expirationTime;
    }

    struct UserOrderDetails {
        uint256 orderIndex;
        address orderOwner;
    }

    struct OrderDetailsWithId {
        uint256 orderId;
        uint256 remainingFillPercentage;
        uint256 redeemedPercentage;
        uint32 lastUpdateTime; // Timestamp of when the order was last updated to trigger the cooldownPeriod
        OrderStatus status;
        uint256 creationProtocolFee;
        OrderDetails orderDetails;
    }

    struct CompleteOrderDetails {
        UserOrderDetails userDetails;
        OrderDetailsWithId orderDetailsWithId;
    }

    mapping(address => OrderDetailsWithId[]) private orders;
    mapping(uint256 => UserOrderDetails) private userDetailsByOrderId;
    mapping(uint256 => mapping(uint256 => uint256)) private buyTransactionsByOrderId;

    uint256 private orderCounter = 0;
    address private feeAddress; // Collects listingFee and protocolFee
    uint32 private cooldownPeriod; // MEV and flash-loan order protection in seconds 
    uint256 public listingFee; // Fixed per order amount in PLS (1 PLS = 10^18)
    uint256 public protocolFee; // Percentage of proceeds in basis points (100 = 1%)
    
    uint256 public constant PERCENTAGE_DIVISOR = 10000;
    uint256 public constant DIVISOR = 10 ** 18;
    uint256 public immutable PROTOCOL_FEES_LIMIT;
    uint256 public immutable LISTING_FEES_LIMIT;

    bool public paused;

    address public constant NATIVE_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    // Track unique users with orders for findFillableOrders
    address[] private allUsersWithOrders;
    mapping(address => bool) private hasOrders;
    mapping(address => uint256) private userIndexInList;

    /// @dev Emitted when a cleanup batch starts
    event UserListCleanupStarted(uint256 cursor, uint256 size, uint256 totalUsers);

    /// @dev Emitted when a cleanup batch finishes
    event UserListCleanupFinished(uint256 cursor, uint256 size, uint256 removedCount, uint256 remainingUsers);

    event OrderPlaced(address indexed user, uint256 indexed orderId, address indexed sellToken, uint256 sellAmount, uint256[] buyTokensIndex, uint256[] buyAmounts, uint256 expirationTime);
    event OrderCancelled(address indexed user, uint256 indexed orderId);
    event OrderUpdated(uint256 indexed orderId, uint256 newExpiration);
    event OrderFilled(address indexed buyer, uint256 indexed orderId, uint256 indexed buyTokenIndex);
    event OrderProceedsCollected(address indexed user, uint256 indexed orderId);
    event Paused(address indexed owner, bool paused);
    event FeeAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event CooldownPeriodUpdated(uint32 oldPeriod, uint32 newPeriod);
    event ListingFeeUpdated(uint256 oldFee, uint256 newFee);
    event ProtocolFeeUpdated(uint256 oldFee, uint256 newFee);

    modifier validOrderId(uint256 _orderId) {
        require(_orderId <= orderCounter, "AgoraX: Invalid order ID");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "AgoraX: Contract is paused");
        _;
    }

    modifier validActiveOrder(uint256 _orderId) {
        UserOrderDetails memory userOrderDetails = userDetailsByOrderId[_orderId];
        require(userOrderDetails.orderOwner != address(0), "AgoraX: Invalid order");
        
        OrderDetailsWithId memory order = orders[userOrderDetails.orderOwner][userOrderDetails.orderIndex];
        require(order.status == OrderStatus.Active, "AgoraX: Order not active");
        require(order.orderDetails.expirationTime > block.timestamp, "AgoraX: Order expired");
        require(order.remainingFillPercentage > 0, "AgoraX: Nothing left to fill");
        _;
    }

    constructor(
        address _feeAddress,
        uint256 _listingFee,
        uint256 _protocolFee,
        uint32 _cooldownPeriod,
        uint256 _listingFeesLimit,
        uint256 _protocolFeesLimit
    ) ERC20("AgoraX", "AGX") Ownable(msg.sender) {
        require(_feeAddress != address(0), "AgoraX: Invalid fee address");
        require(_listingFee <= _listingFeesLimit, "AgoraX: Listing fee exceeds limit");
        require(_protocolFee <= _protocolFeesLimit, "AgoraX: Protocol fee exceeds limit");
        require(_listingFeesLimit > 0, "AgoraX: Listing fee limit must be > 0");
        require(_protocolFeesLimit <= PERCENTAGE_DIVISOR, "AgoraX: Protocol fee limit exceeds 100%");
        
        feeAddress = _feeAddress;
        listingFee = _listingFee;
        protocolFee = _protocolFee;
        cooldownPeriod = _cooldownPeriod;
        LISTING_FEES_LIMIT = _listingFeesLimit;
        PROTOCOL_FEES_LIMIT = _protocolFeesLimit;
    }

    /// @notice Pauses the contract, preventing filling and placing orders
    /// @dev Only callable by the owner
    function pause() external onlyOwner {
        require(!paused, "AgoraX: Contract already paused");
        paused = true;
        emit Paused(msg.sender, true);
    }

    /// @notice Unpauses the contract, allowing filling and placing orders
    /// @dev Only callable by the owner
    function unpause() external onlyOwner {
        require(paused, "AgoraX: Contract not paused");
        paused = false;
        emit Paused(msg.sender, false);
    }

    /// @notice Updates the fee address for fee collection
    /// @param _newFeeAddress The new fee address
    /// @dev Only callable by the owner
    function updateFeeAddress(address _newFeeAddress) external onlyOwner {
        require(_newFeeAddress != address(0), "AgoraX: Invalid fee address");
        require(_newFeeAddress != feeAddress, "AgoraX: Fee address matches previous");
        address oldAddress = feeAddress;
        feeAddress = _newFeeAddress;
        emit FeeAddressUpdated(oldAddress, _newFeeAddress);
    }

    /// @notice Updates the cooldown period
    /// @param _newCoolDownPeriod The new cooldown period in seconds
    /// @dev Only callable by the owner
    function updateCoolDownPeriod(uint32 _newCoolDownPeriod) external onlyOwner {
        emit CooldownPeriodUpdated(cooldownPeriod, _newCoolDownPeriod);
        cooldownPeriod = _newCoolDownPeriod;
    }

    /// @notice Updates the listing fee
    /// @param _newFee The new listing fee in PLS (1 PLS = 10^18)
    /// @dev Only callable by the owner
    function updateListingFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= LISTING_FEES_LIMIT, "AgoraX: Listing fee exceeds limit");
        emit ListingFeeUpdated(listingFee, _newFee);
        listingFee = _newFee;
    }

    /// @notice Updates the protocol fee
    /// @param _newFee The new protocol fee in basis points (100 = 1%)
    /// @dev Only callable by the owner
    function updateProtocolFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= PROTOCOL_FEES_LIMIT, "AgoraX: Protocol fee exceeds limit");
        require(_newFee <= PERCENTAGE_DIVISOR, "AgoraX: Protocol fee cannot exceed 100%");
        emit ProtocolFeeUpdated(protocolFee, _newFee);
        protocolFee = _newFee;
    }

    /// @notice Removes users with zero AGX balance from the active users list
    /// @param cursor Starting index in allUsersWithOrders
    /// @param size Max users to process in this call
    /// @return nextCursor Next starting index for continued cleanup
    function cleanInactiveUsers(uint256 cursor, uint256 size)
        external
        onlyOwner
        returns (uint256 nextCursor)
    {
        uint256 total = allUsersWithOrders.length;
        uint256 end = cursor + size;
        if (end > total) end = total;

        emit UserListCleanupStarted(cursor, size, total);

        uint256 removed = 0;
        for (uint256 i = end; i > cursor; ) {
            unchecked { i--; }
            address user = allUsersWithOrders[i];

            if (balanceOf(user) == 0 && hasOrders[user]) {
                // swap-and-pop
                uint256 lastIdx = allUsersWithOrders.length - 1;
                address lastUser = allUsersWithOrders[lastIdx];

                allUsersWithOrders[i] = lastUser;
                userIndexInList[lastUser] = i;
                allUsersWithOrders.pop();

                delete userIndexInList[user];
                hasOrders[user] = false;

                removed++;
            }
        }

        emit UserListCleanupFinished(cursor, size, removed, allUsersWithOrders.length);
        return end;
    }

    /// @notice Places a new limit order
    /// @notice Duplicate buy tokens not allowed within the same order
    /// @param _orderDetails The details of the order ["sell token address", "sell amount", [buy token(s) index], ["buy amount(s)"], "expiration time"]
    function placeOrder(OrderDetails calldata _orderDetails) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
    {
        require(_orderDetails.buyTokensIndex.length > 0, "AgoraX: At least one buy token required");
        require(_orderDetails.buyTokensIndex.length <= 50, "AgoraX: Too many buy tokens");
        require(_orderDetails.buyTokensIndex.length == _orderDetails.buyAmounts.length, "AgoraX: Array length mismatch");

        // Prevents accidental duplicate buy tokens
        {
            for (uint256 i = 0; i < _orderDetails.buyTokensIndex.length; ) {
                for (uint256 j = i + 1; j < _orderDetails.buyTokensIndex.length; ) {
                    if (_orderDetails.buyTokensIndex[i] == _orderDetails.buyTokensIndex[j]) {
                        revert("AgoraX: Duplicate buy tokens not allowed");
                    }
                    unchecked { ++j; }
                }
                unchecked { ++i; }
            }
        }

        _checkTokenAndAmount(_orderDetails.buyTokensIndex, _orderDetails.buyAmounts);
        
        require(msg.value >= listingFee, "AgoraX: Insufficient listing fee");
        require(_orderDetails.sellAmount > 0, "AgoraX: Sell amount must be > 0");
        require(_orderDetails.expirationTime > block.timestamp, "AgoraX: Expiration must be in the future");

        // Collect listing fee first
        _sendNativeToFeeAddress(listingFee);
        uint256 remainingValue = msg.value - listingFee;

        orderCounter++;
        OrderDetailsWithId memory orderDetailsWithId = OrderDetailsWithId({
            orderId: orderCounter,
            remainingFillPercentage: DIVISOR,
            redeemedPercentage: 0,
            lastUpdateTime: uint32(block.timestamp),
            status: OrderStatus.Active,
            creationProtocolFee: protocolFee, // Records protocol fee current at time of order creation
            orderDetails: _orderDetails
        });
        
        orders[msg.sender].push(orderDetailsWithId);
        UserOrderDetails memory userOrderDetails = UserOrderDetails({
            orderIndex: orders[msg.sender].length - 1,
            orderOwner: msg.sender
        });
        userDetailsByOrderId[orderCounter] = userOrderDetails;
        

        if (_orderDetails.sellToken == NATIVE_ADDRESS) {
            require(remainingValue >= _orderDetails.sellAmount, "AgoraX: Insufficient PLS message value");
            uint256 extra = remainingValue - _orderDetails.sellAmount;
            if (extra > 0) {
                _sendNative(extra);
            }
        } else {
            require(remainingValue == 0, "AgoraX: PLS message value too high. Exceeds expectations for an ERC20 order");
            uint256 sellTokenAmountBefore = IERC20(_orderDetails.sellToken).balanceOf(address(this));
            IERC20(_orderDetails.sellToken).safeTransferFrom(msg.sender, address(this), _orderDetails.sellAmount);
            uint256 sellTokenAmountAfter = IERC20(_orderDetails.sellToken).balanceOf(address(this));
            require(
                sellTokenAmountAfter - sellTokenAmountBefore == _orderDetails.sellAmount,
                "AgoraX: Sell token transfer failed"
            );
        }

        _mint(msg.sender, _orderDetails.sellAmount);

        // Track unique user for findFillableOrders
        if (!hasOrders[msg.sender]) {
            userIndexInList[msg.sender] = allUsersWithOrders.length;
            allUsersWithOrders.push(msg.sender);
            hasOrders[msg.sender] = true;
        }

        emit OrderPlaced(msg.sender, orderCounter, _orderDetails.sellToken, _orderDetails.sellAmount, _orderDetails.buyTokensIndex, _orderDetails.buyAmounts, _orderDetails.expirationTime);
    }

    /// @notice Cancels an existing order and sends proceeds (if any) to the specified recipient
    /// @param _orderId The ID of the order to cancel
    /// @param _recipient Address to send any accumulated proceeds to
    function cancelOrder(uint256 _orderId, address _recipient) external nonReentrant validOrderId(_orderId) {
        require(_recipient != address(0), "AgoraX: Invalid recipient");
        UserOrderDetails memory userOrderDetails = userDetailsByOrderId[_orderId];
        require(userOrderDetails.orderOwner == msg.sender, "AgoraX: Unauthorized");

        OrderDetailsWithId storage orderDetailsWithId = orders[msg.sender][userOrderDetails.orderIndex];
        require(orderDetailsWithId.status != OrderStatus.Cancelled, "AgoraX: Order already cancelled");

        uint256 remainingFillPercentage = orderDetailsWithId.remainingFillPercentage;
        require(remainingFillPercentage > 0, "AgoraX: Order already completed");

        // Collects proceeds from partial fills and sends to recipient
        uint256 redeemable = DIVISOR - orderDetailsWithId.remainingFillPercentage - orderDetailsWithId.redeemedPercentage;
        if (redeemable > 0) {
            _collectProceeds(_orderId, _recipient);
        }
        
        orderDetailsWithId.status = OrderStatus.Cancelled;
        uint256 refundAmount = (orderDetailsWithId.orderDetails.sellAmount * orderDetailsWithId.remainingFillPercentage) / DIVISOR;
        _burn(msg.sender, refundAmount);

        if (orderDetailsWithId.orderDetails.sellToken == NATIVE_ADDRESS) {
            _sendNative(refundAmount);
        } else {
            IERC20(orderDetailsWithId.orderDetails.sellToken).safeTransfer(msg.sender, refundAmount);
        }
        
        emit OrderCancelled(msg.sender, _orderId);
    }

    /// @notice Cancels all active expired orders (up to 50) for the caller and sends proceeds (if any) to the specified recipient
    /// @param _recipient Address to send any accumulated proceeds to
    /// @return cancelledOrderIds Array of order IDs cancelled
    function cancelAllExpiredOrders(address _recipient) 
        external 
        nonReentrant 
        returns (uint256[] memory cancelledOrderIds) 
    {
        require(_recipient != address(0), "AgoraX: Invalid recipient");
        uint256 userOrdersLength = orders[msg.sender].length;
        uint256 cancelledCount = 0;
        
        // Count cancellable orders to check limit and size the array
        for (uint256 i = 0; i < userOrdersLength; i++) {
            OrderDetailsWithId storage order = orders[msg.sender][i];
            if (order.status == OrderStatus.Active && 
                order.orderDetails.expirationTime <= block.timestamp) {
                cancelledCount++;
            }
        }
        
        require(cancelledCount <= 50, "AgoraX: Too many expired orders for batch cancellation");
        
        cancelledOrderIds = new uint256[](cancelledCount);
        uint256 index = 0;
        
        // Process cancellations
        for (uint256 i = 0; i < userOrdersLength; i++) {
            OrderDetailsWithId storage order = orders[msg.sender][i];
            if (order.status == OrderStatus.Active && 
                order.orderDetails.expirationTime <= block.timestamp) {
                uint256 orderId = order.orderId;
                uint256 redeemable = DIVISOR - order.remainingFillPercentage - order.redeemedPercentage;
                if (redeemable > 0) {
                    _collectProceeds(orderId, _recipient); // Collects proceeds from any partially filled orders
                }
                
                // Only cancel if there's something left to refund
                if (order.remainingFillPercentage > 0) {
                    order.status = OrderStatus.Cancelled;
                    uint256 refundAmount = (order.orderDetails.sellAmount * order.remainingFillPercentage) / DIVISOR;
                    _burn(msg.sender, refundAmount);
                    
                    if (order.orderDetails.sellToken == NATIVE_ADDRESS) {
                        _sendNative(refundAmount);
                    } else {
                        IERC20(order.orderDetails.sellToken).safeTransfer(msg.sender, refundAmount);
                    }
                    
                    cancelledOrderIds[index] = orderId;
                    index++;
                    emit OrderCancelled(msg.sender, orderId);
                }
            }
        }
        
        return cancelledOrderIds;
    }

    /// @notice Fills an order by providing buy tokens at the ratio set by the order
    /// @param _orderId The ID of the order to fill
    /// @param _buyTokenIndexInOrder Index of the buy token in the order's buyTokensIndex array
    /// @param _buyAmount Amount of buy tokens to provide
    function fillOrder(
        uint256 _orderId,
        uint256 _buyTokenIndexInOrder,
        uint256 _buyAmount
    ) external payable nonReentrant validActiveOrder(_orderId) whenNotPaused {
        (address _buyToken, address _sellToken, uint256 _soldAmount, uint256 _fees) = _fillOrder(
            _orderId,
            _buyTokenIndexInOrder,
            _buyAmount
        );

        // Handle buy token transfer and fees
        if (_buyToken == NATIVE_ADDRESS) {
            require(msg.value >= _buyAmount, "AgoraX: Insufficient PLS message value required to fill order");
            uint256 extraTokens = msg.value - _buyAmount;
            if (_fees > 0) {
                _sendNativeToFeeAddress(_fees);
            }
            if (extraTokens > 0) {
                _sendNative(extraTokens);
            }
        } else {
            require(msg.value == 0, "AgoraX: No PLS needed for an ERC20 fill");
            uint256 buyTokenAmountBefore = IERC20(_buyToken).balanceOf(address(this));
            IERC20(_buyToken).safeTransferFrom(msg.sender, address(this), _buyAmount);
            uint256 buyTokenAmountAfter = IERC20(_buyToken).balanceOf(address(this));
            require(
                buyTokenAmountAfter - buyTokenAmountBefore == _buyAmount,
                "AgoraX: Buy token transfer failed"
            );
            if (_fees > 0) {
                IERC20(_buyToken).safeTransfer(feeAddress, _fees);
            }
        }

        // Send sell tokens to buyer
        if (_sellToken == NATIVE_ADDRESS) {
            _sendNative(_soldAmount);
        } else {
            IERC20(_sellToken).safeTransfer(msg.sender, _soldAmount);
        }
    }

    /// @notice Collects accumulated buy tokens for an order that has been partially or completely filled and sends to the specified recipient
    /// @param _orderId The ID of the order
    /// @param _recipient Address to send proceeds to (recipient must be able to accept PLS proceeds, if any)
    function collectProceeds(uint256 _orderId, address _recipient) public nonReentrant validOrderId(_orderId) {
        require(_recipient != address(0), "AgoraX: Invalid recipient");
        _collectProceeds(_orderId, _recipient);
    }

    /// @notice Views open (active and not expired) order IDs for a user
    /// @param _user The user's address
    /// @param _cursor Starting index for pagination
    /// @param _size Number of orders to return
    /// @return openOrders Array of open orders
    /// @return end The next cursor position
    function viewUserOpenOrders(
        address _user,
        uint256 _cursor,
        uint256 _size
    ) external view returns (OrderDetailsWithId[] memory, uint256) {
        uint256 userOrdersLength = orders[_user].length;
        uint256 end = _cursor + _size > userOrdersLength ? userOrdersLength : _cursor + _size;
        uint256 openCount = 0;
        
        // Count open (active and not expired) orders within specified range
        for (uint256 i = _cursor; i < end; i++) {
            if (orders[_user][i].status == OrderStatus.Active && 
                orders[_user][i].orderDetails.expirationTime > block.timestamp) {
                openCount++;
            }
        }
        
        OrderDetailsWithId[] memory openOrders = new OrderDetailsWithId[](openCount);
        uint256 index = 0;
        
        for (uint256 i = _cursor; i < end && index < openCount; i++) {
            if (orders[_user][i].status == OrderStatus.Active && 
                orders[_user][i].orderDetails.expirationTime > block.timestamp) {
                openOrders[index] = orders[_user][i];
                index++;
            }
        }
        
        return (openOrders, end);
    }

    /// @notice Views expired (active but past expiration) order IDs for a user
    /// @param _user The user's address
    /// @param _cursor Starting index for pagination
    /// @param _size Number of orders to return
    /// @return expiredOrders Array of expired orders
    /// @return end The next cursor position
    function viewUserExpiredOrders(
        address _user,
        uint256 _cursor,
        uint256 _size
    ) external view returns (OrderDetailsWithId[] memory, uint256) {
        uint256 userOrdersLength = orders[_user].length;
        uint256 end = _cursor + _size > userOrdersLength ? userOrdersLength : _cursor + _size;
        uint256 expiredCount = 0;
        
        // Count expired orders (active but past expiration)
        for (uint256 i = _cursor; i < end; i++) {
            if (orders[_user][i].status == OrderStatus.Active && 
                orders[_user][i].orderDetails.expirationTime <= block.timestamp) {
                expiredCount++;
            }
        }
        
        OrderDetailsWithId[] memory expiredOrders = new OrderDetailsWithId[](expiredCount);
        uint256 index = 0;
        
        for (uint256 i = _cursor; i < end && index < expiredCount; i++) {
            if (orders[_user][i].status == OrderStatus.Active && 
                orders[_user][i].orderDetails.expirationTime <= block.timestamp) {
                expiredOrders[index] = orders[_user][i];
                index++;
            }
        }
        
        return (expiredOrders, end);
    }

    /// @notice Views completed order IDs for a user
    /// @param _user The user's address
    /// @param _cursor Starting index for pagination
    /// @param _size Number of orders to return
    /// @return completedOrders Array of completed orders
    /// @return end The next cursor position
    function viewUserCompletedOrders(
        address _user,
        uint256 _cursor,
        uint256 _size
    ) external view returns (OrderDetailsWithId[] memory, uint256) {
        uint256 userOrdersLength = orders[_user].length;
        uint256 end = _cursor + _size > userOrdersLength ? userOrdersLength : _cursor + _size;
        uint256 completedCount = 0;
        
        // Count completed orders in range
        for (uint256 i = _cursor; i < end; i++) {
            if (orders[_user][i].status == OrderStatus.Completed) {
                completedCount++;
            }
        }
        
        OrderDetailsWithId[] memory completedOrders = new OrderDetailsWithId[](completedCount);
        uint256 index = 0;
        
        for (uint256 i = _cursor; i < end && index < completedCount; i++) {
            if (orders[_user][i].status == OrderStatus.Completed) {
                completedOrders[index] = orders[_user][i];
                index++;
            }
        }
        
        return (completedOrders, end);
    }

    /// @notice Views cancelled order IDs for a user
    /// @param _user The user's address
    /// @param _cursor Starting index for pagination
    /// @param _size Number of orders to return
    /// @return cancelledOrders Array of cancelled orders
    /// @return end The next cursor position
    function viewUserCancelledOrders(
        address _user,
        uint256 _cursor,
        uint256 _size
    ) external view returns (OrderDetailsWithId[] memory, uint256) {
        uint256 userOrdersLength = orders[_user].length;
        uint256 end = _cursor + _size > userOrdersLength ? userOrdersLength : _cursor + _size;
        uint256 cancelledCount = 0;
        
        // Count cancelled orders in range
        for (uint256 i = _cursor; i < end; i++) {
            if (orders[_user][i].status == OrderStatus.Cancelled) {
                cancelledCount++;
            }
        }
        
        OrderDetailsWithId[] memory cancelledOrders = new OrderDetailsWithId[](cancelledCount);
        uint256 index = 0;
        
        for (uint256 i = _cursor; i < end && index < cancelledCount; i++) {
            if (orders[_user][i].status == OrderStatus.Cancelled) {
                cancelledOrders[index] = orders[_user][i];
                index++;
            }
        }
        
        return (cancelledOrders, end);
    }

    /// @notice Returns the number of expired orders for a user
    /// @param _user The user's address
    /// @return The number of expired orders
    function getUserExpiredOrdersCount(address _user) external view returns (uint256) {
        uint256 userOrdersLength = orders[_user].length;
        uint256 expiredCount = 0;
        
        for (uint256 i = 0; i < userOrdersLength; i++) {
            if (orders[_user][i].status == OrderStatus.Active && 
                orders[_user][i].orderDetails.expirationTime <= block.timestamp) {
                expiredCount++;
            }
        }
        
        return expiredCount;
    }

    /// @notice Sets a new expiration time for an order
    /// @param _orderId The order ID
    /// @param _newExpiration New expiration timestamp
    function updateOrderExpiration(uint256 _orderId, uint256 _newExpiration) external nonReentrant validOrderId(_orderId) {
        UserOrderDetails memory userDetails = userDetailsByOrderId[_orderId];
        require(userDetails.orderOwner == msg.sender, "AgoraX: Unauthorized");
        
        OrderDetailsWithId storage orderWithId = orders[msg.sender][userDetails.orderIndex];
        require(orderWithId.status == OrderStatus.Active, "AgoraX: Order not active");
        
        bool wasExpired = (orderWithId.orderDetails.expirationTime <= block.timestamp);
        
        require(_newExpiration > block.timestamp, "AgoraX: New expiration time must be in the future");
        
        orderWithId.orderDetails.expirationTime = _newExpiration;
        if (wasExpired) {
            orderWithId.lastUpdateTime = uint32(block.timestamp);
        }
        emit OrderUpdated(_orderId, _newExpiration);
    }

    /// @notice Returns the current block timestamp in seconds (Unix format)
    /// @return The current timestamp
    function getCurrentTimestamp() external view returns (uint256) {
        return block.timestamp;
    }

    /// @notice Finds fillable orders matching specified criteria
    /// @param _sellToken Sell token to match
    /// @param _minSellAmount Minimum remaining sell amount
    /// @param cursor Starting index for pagination (over users)
    /// @param size Max number of matching orders to return (up to 50)
    /// @return orderIds Array of matching order IDs (sorted ascending)
    /// @return nextCursor Next starting index for pagination
    function findFillableOrders(
        address _sellToken,
        uint256 _minSellAmount,
        uint256 cursor,
        uint256 size
    ) external view returns (uint256[] memory orderIds, uint256 nextCursor) {
        require(size <= 50, "AgoraX: Size exceeds max (50)");

        uint256 totalUsers = allUsersWithOrders.length;
        uint256 startUser = cursor < totalUsers ? cursor : totalUsers;
        uint256 endUser = startUser + 1000; // Scan stops if size matches
        if (endUser > totalUsers) endUser = totalUsers;

        uint256[] memory temp = new uint256[](size);
        uint256 cnt = 0;
        uint256 processed = 0;

        for (uint256 u = startUser; u < endUser && cnt < size; ++u) {
            address user = allUsersWithOrders[u];
            OrderDetailsWithId[] storage userOrders = orders[user];

            for (uint256 i = 0; i < userOrders.length && cnt < size; ++i) {
                if (userOrders[i].status != OrderStatus.Active) continue;
                if (userOrders[i].orderDetails.sellToken != _sellToken) continue;
                if (userOrders[i].orderDetails.expirationTime <= block.timestamp) continue;

                uint256 remainingSell = (userOrders[i].orderDetails.sellAmount * userOrders[i].remainingFillPercentage) / DIVISOR;

                if (remainingSell < _minSellAmount) continue;

                temp[cnt] = userOrders[i].orderId;
                cnt++;
            }
            processed++;
        }

        orderIds = new uint256[](cnt);
        for (uint256 i = 0; i < cnt; ++i) {
            orderIds[i] = temp[i];
        }

        // Bubble sort ascending
        for (uint256 i = 0; i < cnt - 1; ++i) {
            for (uint256 j = 0; j < cnt - i - 1; ++j) {
                if (orderIds[j] > orderIds[j + 1]) {
                    (orderIds[j], orderIds[j + 1]) = (orderIds[j + 1], orderIds[j]);
                }
            }
        }

        nextCursor = startUser + processed;
    }

    function _fillOrder(
        uint256 _orderId,
        uint256 _buyTokenIndexInOrder,
        uint256 _buyAmount
    ) internal returns (address _buyTokenAddress, address _sellTokenAddress, uint256 _soldAmount, uint256 _fees) {
        OrderDetailsWithId storage orderDetailsWithId;
        uint256 buyTokenIndex;
        {
            UserOrderDetails memory userOrderDetails = userDetailsByOrderId[_orderId];
            orderDetailsWithId = orders[userOrderDetails.orderOwner][userOrderDetails.orderIndex];

            require(
                orderDetailsWithId.lastUpdateTime + cooldownPeriod < uint32(block.timestamp),
                "AgoraX: Order still in cooldown period"
            );

            require(_buyTokenIndexInOrder < orderDetailsWithId.orderDetails.buyTokensIndex.length, "AgoraX: Invalid buy token index");

            buyTokenIndex = orderDetailsWithId.orderDetails.buyTokensIndex[_buyTokenIndexInOrder];
            (_buyTokenAddress, ) = getTokenInfoAt(buyTokenIndex);

            uint256 originalBuyAmount = orderDetailsWithId.orderDetails.buyAmounts[_buyTokenIndexInOrder];
            require(originalBuyAmount > 0, "AgoraX: Invalid buy amount");
            
            require(_buyAmount <= originalBuyAmount, "AgoraX: Excessive buy amount");
            
            uint256 percentage = (_buyAmount * DIVISOR) / originalBuyAmount;
            require(orderDetailsWithId.remainingFillPercentage >= percentage, "AgoraX: Buy amount exceeds order availability");

            _soldAmount = (orderDetailsWithId.orderDetails.sellAmount * percentage) / DIVISOR;
            orderDetailsWithId.remainingFillPercentage -= percentage;
            _sellTokenAddress = orderDetailsWithId.orderDetails.sellToken;

            if (orderDetailsWithId.remainingFillPercentage == 0) {
                orderDetailsWithId.status = OrderStatus.Completed;
            }
        }

        // Protocol fee collected as a percentage of proceeds (compares creationProtocolFee and current protocolFee and uses whichever is smallest)
        uint256 effectiveFee = (orderDetailsWithId.creationProtocolFee < protocolFee) 
            ? orderDetailsWithId.creationProtocolFee 
            : protocolFee;
        _fees = (_buyAmount * effectiveFee) / PERCENTAGE_DIVISOR;
        uint256 _newBoughtAmount = _buyAmount > _fees ? _buyAmount - _fees : 0;
        buyTransactionsByOrderId[_orderId][buyTokenIndex] += _newBoughtAmount;

        emit OrderFilled(msg.sender, _orderId, buyTokenIndex);
    }

    function _collectProceeds(uint256 _orderId, address _recipient) internal {
        UserOrderDetails memory userOrderDetails = userDetailsByOrderId[_orderId];
        require(userOrderDetails.orderOwner == msg.sender, "AgoraX: Unauthorized");
        
        OrderDetailsWithId storage orderDetailsWithId = orders[msg.sender][userOrderDetails.orderIndex];
        uint256 redeemable = DIVISOR - orderDetailsWithId.remainingFillPercentage - orderDetailsWithId.redeemedPercentage;
        
        require(redeemable > 0, "AgoraX: Nothing to collect");

        // Pre-check if recipient can accept PLS (if order has any PLS proceeds)
        bool hasNative = false;
        for (uint256 i = 0; i < orderDetailsWithId.orderDetails.buyTokensIndex.length; i++) {
            uint256 currentBuyTokenIndex = orderDetailsWithId.orderDetails.buyTokensIndex[i];
            (address currentBuyToken, ) = getTokenInfoAt(currentBuyTokenIndex);
            uint256 boughtAmount = buyTransactionsByOrderId[_orderId][currentBuyTokenIndex];
            if (boughtAmount > 0 && currentBuyToken == NATIVE_ADDRESS) {
                hasNative = true;
                break;
            }
        }
        if (hasNative) {
            (bool canReceive, ) = _recipient.call{value: 0}("");
            require(canReceive, "AgoraX: Recipient does not accept PLS transfers");
        }

        orderDetailsWithId.redeemedPercentage += redeemable;
        uint256 redeemAmount = (orderDetailsWithId.orderDetails.sellAmount * redeemable) / DIVISOR;
        _burn(msg.sender, redeemAmount);

        // Collects accumulated buy tokens
        for (uint256 i = 0; i < orderDetailsWithId.orderDetails.buyTokensIndex.length; i++) {
            uint256 currentBuyTokenIndex = orderDetailsWithId.orderDetails.buyTokensIndex[i];
            (address currentBuyToken, ) = getTokenInfoAt(currentBuyTokenIndex);
            uint256 boughtAmount = buyTransactionsByOrderId[_orderId][currentBuyTokenIndex];
            
            if (boughtAmount > 0) {
                buyTransactionsByOrderId[_orderId][currentBuyTokenIndex] = 0;
                if (currentBuyToken == NATIVE_ADDRESS) {
                    _sendNativeToRecipient(boughtAmount, _recipient);
                } else {
                    IERC20(currentBuyToken).safeTransfer(_recipient, boughtAmount);
                }
            }
        }

        emit OrderProceedsCollected(msg.sender, _orderId);
    }

    function _checkTokenAndAmount(uint256[] calldata _tokensIndex, uint256[] calldata _amounts) internal view {
        for (uint256 i = 0; i < _tokensIndex.length; i++) {
            (, bool active) = getTokenInfoAt(_tokensIndex[i]);
            require(active, "AgoraX: Inactive token");
            require(_amounts[i] > 0, "AgoraX: Zero buy amount");
        }
    }

    function _sendNative(uint256 _amount) internal {
        (bool sent, ) = payable(msg.sender).call{value: _amount}("");
        require(sent, "AgoraX: PLS transfer failed");
    }

    function _sendNativeToFeeAddress(uint256 _amount) internal {
        (bool sent, ) = payable(feeAddress).call{value: _amount}("");
        require(sent, "AgoraX: PLS fee transfer failed");
    }

    function _sendNativeToRecipient(uint256 _amount, address _recipient) internal {
        (bool sent, ) = payable(_recipient).call{value: _amount}("");
        require(sent, "AgoraX: PLS transfer failed");
    }

    // ========== ADDITIONAL VIEW FUNCTIONS ==========

    /// @notice Returns the number of orders for a user
    /// @param _user The user's address
    /// @return The number of orders
    function getUserOrderCount(address _user) external view returns (uint256) {
        return orders[_user].length;
    }

    /// @notice Returns the details of a specific order
    /// @param _orderId The ID of the order
    /// @return The complete order details
    function getOrderDetails(uint256 _orderId) external view validOrderId(_orderId) returns (CompleteOrderDetails memory) {
        UserOrderDetails memory userDetails = userDetailsByOrderId[_orderId];
        OrderDetailsWithId memory orderDetailsWithId = orders[userDetails.orderOwner][userDetails.orderIndex];
        return CompleteOrderDetails({userDetails: userDetails, orderDetailsWithId: orderDetailsWithId});
    }

    /// @notice Returns the total number of orders created
    /// @return The order counter
    function getTotalOrderCount() external view returns (uint256) {
        return orderCounter;
    }

    /// @notice Returns the fee address for fee collection
    /// @return The fee address
    function getFeeAddress() external view returns (address) {
        return feeAddress;
    }

    /// @notice Returns the cooldown period for newly placed orders
    /// @return The cooldown period in seconds
    function getCooldownPeriod() external view returns (uint32) {
        return cooldownPeriod;
    }

    /// @notice Returns the current listing fee
    /// @return The listing fee in PLS (1 PLS = 10^18)
    function getListingFee() external view returns (uint256) {
        return listingFee;
    }

    /// @notice Returns the current protocol fee
    /// @return The protocol fee in basis points
    function getProtocolFee() external view returns (uint256) {
        return protocolFee;
    }

    /// @notice Current number of tracked users that have ever placed an order
    /// @return Number of entries in the internal list
    function trackedUserCount() external view returns (uint256) {
        return allUsersWithOrders.length;
    }

    // ========== DISABLED ERC20 FUNCTIONS ==========
    /// @dev AGX receipt tokens are non-transferable - overrides parent implementation
    function transfer(address, uint256) public pure override returns (bool) {
        revert("AGX: Transfer disabled");
    }

    /// @dev AGX receipt tokens cannot be approved - overrides parent implementation
    function approve(address, uint256) public pure override returns (bool) {
        revert("AGX: Approve disabled");
    }

    /// @dev AGX receipt tokens cannot be transferred from - overrides parent implementation
    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert("AGX: TransferFrom disabled");
    }

    /// @dev AGX receipt tokens have no allowance - overrides parent implementation
    function allowance(address, address) public pure override returns (uint256) {
        revert("AGX: Allowance disabled");
    }

    /// @dev AGX receipt tokens have fixed decimals - overrides parent implementation
    function decimals() public view virtual override returns (uint8) {
        return 18;
    }

    // ========== FALLBACK ==========
    // Fallback function to reject accidental direct-to-contract PLS transfers
    receive() external payable {
        revert("AgoraX: Direct PLS transfers not allowed");
    }
}