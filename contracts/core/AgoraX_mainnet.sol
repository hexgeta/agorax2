// SPDX-License-Identifier: UNLICENSED
//
// AgoraX Mainnet Contract
// Deployed at: 0xc8a47F14b1833310E2aC72e4C397b5b14a9FEf8B
// Network: PulseChain Mainnet (Chain ID: 369)
//
// This is the reference implementation of the AgoraX limit order platform.
//
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

// ========== WHITELIST ==========
abstract contract Whitelist is Ownable2Step {
    struct TokenInfo {
        address tokenAddress;
        bool isActive;
    }

    TokenInfo[] private whitelistedTokens;
    mapping(address => uint256) private tokenIndexes;

    event TokenWhitelisted(address indexed token);
    event TokenStatusChanged(address indexed token, bool isActive);

    /// @dev Whitelists a single token address
    /// @dev Only callable by the owner
    /// @param _address Address to whitelist
    function addTokenAddress(address _address) external onlyOwner {
        if (_address == address(0) || tokenIndexes[_address] != 0) {
            return; // Skip zero address or already whitelisted
        }
        whitelistedTokens.push(TokenInfo(_address, true));
        tokenIndexes[_address] = whitelistedTokens.length;
        emit TokenWhitelisted(_address);
    }

    /// @dev Changes the active status of a whitelisted token
    /// @dev Only callable by the owner
    /// @param _address Token address
    /// @param _isActive New status
    function setTokenStatus(
        address _address,
        bool _isActive
    ) external onlyOwner {
        uint256 index = tokenIndexes[_address];
        require(index > 0, "Whitelist: Address not found");
        uint256 realIndex = index - 1;
        require(
            realIndex < whitelistedTokens.length,
            "Whitelist: Index out of bounds"
        );
        require(
            whitelistedTokens[realIndex].isActive != _isActive,
            "Whitelist: Status already set"
        );
        whitelistedTokens[realIndex].isActive = _isActive;
        emit TokenStatusChanged(_address, _isActive);
    }

    /// @notice Checks if a token has been whitelisted and is currently active
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
    function getTokenInfoAt(
        uint256 _index
    ) public view returns (address, bool) {
        require(_index < whitelistedTokens.length, "Whitelist: Invalid index");
        TokenInfo memory info = whitelistedTokens[_index];
        return (info.tokenAddress, info.isActive);
    }

    /// @notice Get whitelist index for a specific token
    /// @param _address Token address
    function getTokenWhitelistIndex(
        address _address
    ) public view returns (uint256) {
        uint256 index = tokenIndexes[_address];
        require(index > 0, "Whitelist: Token not whitelisted");
        return index - 1; // 0-based array index
    }

    /// @notice View whitelisted tokens, both active and inactive
    /// @param cursor Cursor (should start at 0 for first request)
    /// @param size Size of the response
    function viewWhitelisted(
        uint256 cursor,
        uint256 size
    ) external view returns (TokenInfo[] memory, uint256) {
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
    function viewActiveWhitelisted(
        uint256 cursor,
        uint256 size
    ) external view returns (address[] memory, uint256) {
        uint256 activeCount = 0;
        uint256 end = cursor + size > whitelistedTokens.length
            ? whitelistedTokens.length
            : cursor + size;
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
        uint64 expirationTime;
        bool allOrNothing;
    }

    struct UserOrderDetails {
        uint256 orderIndex;
        address orderOwner;
    }

    struct OrderDetailsWithID {
        uint256 orderID;
        uint256 remainingSellAmount;
        uint256 redeemedSellAmount; // Total sell amount for which proceeds have been collected
        uint64 lastUpdateTime; // Timestamp of the most recent order update to trigger the cooldown period
        OrderStatus status; // Active (Open or Expired), Cancelled, Completed
        uint256 creationProtocolFee; // Protocol fee current at time of order creation
        OrderDetails orderDetails;
    }

    struct CompleteOrderDetails {
        UserOrderDetails userDetails;
        OrderDetailsWithID orderDetailsWithID;
    }

    mapping(address => OrderDetailsWithID[]) private orders;
    mapping(uint256 => UserOrderDetails) private userDetailsByOrderID;
    mapping(uint256 => mapping(uint256 => uint256))
        private buyTransactionsByOrderID;

    uint256 private orderCounter = 0;
    address public feeAddress; // Collects listingFee and protocolFee
    uint64 public cooldownPeriod; // MEV and flash-loan order protection in seconds
    uint256 public listingFee; // Fixed per order amount in PLS (1 PLS = 10^18)
    uint256 public protocolFee; // Percentage of proceeds in basis points (100 = 1%)

    uint256 public constant PERCENTAGE_DIVISOR = 10000;
    uint256 public immutable PROTOCOL_FEES_LIMIT;
    uint256 public immutable LISTING_FEES_LIMIT;
    bool public paused;
    address public constant NATIVE_ADDRESS =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    // Tracks unique users with orders for findFillableOrders
    address[] private allUsersWithOrders;
    mapping(address => bool) private hasOrders;
    mapping(address => uint256) private userIndexInList;

    event UserListCleanup(
        uint256 cursor,
        uint256 size,
        uint256 removedCount,
        uint256 remainingUsers
    );
    event OrderPlaced(
        address indexed user,
        uint256 indexed orderID,
        address indexed sellToken,
        uint256 sellAmount,
        uint256[] buyTokensIndex,
        uint256[] buyAmounts,
        uint64 expirationTime,
        bool allOrNothing
    );
    event OrderCancelled(address indexed user, uint256 indexed orderID);
    event OrderExpirationUpdated(uint256 indexed orderID, uint64 newExpiration);
    event OrderFilled(
        address indexed buyer,
        uint256 indexed orderID,
        uint256 indexed buyTokenIndex,
        uint256 buyAmount
    );
    event OrderProceedsCollected(address indexed user, uint256 indexed orderID);
    event Paused(address indexed owner, bool paused);
    event FeeAddressUpdated(
        address indexed oldAddress,
        address indexed newAddress
    );
    event CooldownPeriodUpdated(uint64 oldPeriod, uint64 newPeriod);
    event ListingFeeUpdated(uint256 oldFee, uint256 newFee);
    event ProtocolFeeUpdated(uint256 oldFee, uint256 newFee);

    modifier validOrderID(uint256 _orderID) {
        require(_orderID <= orderCounter, "AgoraX: Invalid order ID");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "AgoraX: Contract is paused");
        _;
    }

    modifier validActiveOrder(uint256 _orderID) {
        UserOrderDetails memory userOrderDetails = userDetailsByOrderID[
            _orderID
        ];
        require(
            userOrderDetails.orderOwner != address(0),
            "AgoraX: Invalid order"
        );

        OrderDetailsWithID memory order = orders[userOrderDetails.orderOwner][
            userOrderDetails.orderIndex
        ];
        require(order.status == OrderStatus.Active, "AgoraX: Order not active");
        require(
            order.orderDetails.expirationTime > block.timestamp,
            "AgoraX: Order expired"
        );
        require(order.remainingSellAmount > 0, "AgoraX: Nothing left to fill");
        _;
    }

    constructor(
        address _feeAddress,
        uint256 _listingFee,
        uint256 _protocolFee,
        uint64 _cooldownPeriod,
        uint256 _listingFeesLimit,
        uint256 _protocolFeesLimit
    ) ERC20("AgoraX", "AGX") Ownable(msg.sender) {
        require(_feeAddress != address(0), "AgoraX: Invalid fee address");
        require(
            _listingFee <= _listingFeesLimit,
            "AgoraX: Listing fee exceeds limit"
        );
        require(
            _protocolFee <= _protocolFeesLimit,
            "AgoraX: Protocol fee exceeds limit"
        );
        require(_listingFeesLimit > 0, "AgoraX: Listing fee limit must be > 0");
        require(
            _protocolFeesLimit > 0,
            "AgoraX: Protocol fee limit must be > 0"
        );
        require(
            _protocolFeesLimit <= PERCENTAGE_DIVISOR,
            "AgoraX: Protocol fee limit exceeds 100%"
        );

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
        require(
            _newFeeAddress != address(0) && _newFeeAddress != address(this),
            "AgoraX: Invalid fee address"
        );
        require(
            _newFeeAddress != feeAddress,
            "AgoraX: New fee address matches current"
        );
        address oldAddress = feeAddress;
        feeAddress = _newFeeAddress;
        emit FeeAddressUpdated(oldAddress, _newFeeAddress);
    }

    /// @notice Updates the cooldown period
    /// @param _newCooldownPeriod The new cooldown period in seconds
    /// @dev Only callable by the owner
    function updateCooldownPeriod(
        uint64 _newCooldownPeriod
    ) external onlyOwner {
        require(
            _newCooldownPeriod >= 20 && _newCooldownPeriod <= 86400,
            "AgoraX: New cooldown period out of bounds"
        );
        emit CooldownPeriodUpdated(cooldownPeriod, _newCooldownPeriod);
        cooldownPeriod = _newCooldownPeriod;
    }

    /// @notice Updates the listing fee
    /// @param _newFee The new listing fee in PLS (1 PLS = 10^18)
    /// @dev Only callable by the owner
    function updateListingFee(uint256 _newFee) external onlyOwner {
        require(
            _newFee <= LISTING_FEES_LIMIT,
            "AgoraX: Listing fee exceeds limit"
        );
        emit ListingFeeUpdated(listingFee, _newFee);
        listingFee = _newFee;
    }

    /// @notice Updates the protocol fee
    /// @param _newFee The new protocol fee in basis points (100 = 1%)
    /// @dev Only callable by the owner
    function updateProtocolFee(uint256 _newFee) external onlyOwner {
        require(
            _newFee <= PROTOCOL_FEES_LIMIT,
            "AgoraX: Protocol fee exceeds limit"
        );
        emit ProtocolFeeUpdated(protocolFee, _newFee);
        protocolFee = _newFee;
    }

    /// @notice Removes users with zero AGX balance from the active users list for improved findFillableOrders performance
    /// @param cursor Starting index in allUsersWithOrders
    /// @param size Max users to process in this call
    /// @return nextCursor Next starting index for continued cleanup
    /// @dev Only callable by the owner
    function cleanInactiveUsers(
        uint256 cursor,
        uint256 size
    ) external onlyOwner returns (uint256 nextCursor) {
        uint256 total = allUsersWithOrders.length;
        uint256 end = cursor + size;
        if (end > total) end = total;
        uint256 removed = 0;
        for (uint256 i = end; i > cursor; ) {
            unchecked {
                i--;
            }
            address user = allUsersWithOrders[i];
            if (balanceOf(user) == 0 && hasOrders[user]) {
                uint256 lastIdx = allUsersWithOrders.length - 1;
                address lastUser = allUsersWithOrders[lastIdx];
                allUsersWithOrders[i] = lastUser;
                userIndexInList[lastUser] = i;
                allUsersWithOrders.pop();
                delete userIndexInList[user];
                hasOrders[user] = false;
                unchecked {
                    removed++;
                }
            }
        }
        emit UserListCleanup(cursor, size, removed, allUsersWithOrders.length);
        return end;
    }

    /// @notice Places a new limit order
    /// @notice Sell tokens with taxes/fees on transfer not allowed
    /// @notice Sell tokens that rebase can lead to unexpected behavior or failures due to balance changes
    /// @notice Duplicate buy tokens not allowed within the same order
    /// @param _sellToken The sell token address
    /// @param _sellAmount The sell amount
    /// @param _buyTokensIndex Array of buy token indices (from whitelist)
    /// @param _buyAmounts Array of buy amounts (parallel to _buyTokensIndex)
    /// @param _expirationTime Expiration timestamp (must be in the future)
    /// @param _allOrNothing If true, partial fills not allowed
    function placeOrder(
        address _sellToken,
        uint256 _sellAmount,
        uint256[] calldata _buyTokensIndex,
        uint256[] calldata _buyAmounts,
        uint64 _expirationTime,
        bool _allOrNothing
    ) external payable nonReentrant whenNotPaused {
        require(
            _buyTokensIndex.length > 0,
            "AgoraX: At least one buy token required"
        );
        require(_buyTokensIndex.length <= 50, "AgoraX: Too many buy tokens");
        require(
            _buyTokensIndex.length == _buyAmounts.length,
            "AgoraX: Array length mismatch"
        );

        // Prevents accidental duplicate buy tokens
        {
            for (uint256 i = 0; i < _buyTokensIndex.length; ) {
                for (uint256 j = i + 1; j < _buyTokensIndex.length; ) {
                    if (_buyTokensIndex[i] == _buyTokensIndex[j]) {
                        revert("AgoraX: Duplicate buy tokens not allowed");
                    }
                    unchecked {
                        ++j;
                    }
                }
                unchecked {
                    ++i;
                }
            }
        }

        _checkTokenAndAmount(_buyTokensIndex, _buyAmounts);

        require(msg.value >= listingFee, "AgoraX: Insufficient listing fee");
        require(_sellAmount > 0, "AgoraX: Sell amount must be > 0");
        require(
            _expirationTime > block.timestamp,
            "AgoraX: Expiration must be in the future"
        );

        // Collect listing fee first
        _sendNativeToFeeAddress(listingFee);
        uint256 remainingValue = msg.value - listingFee;

        orderCounter++;

        OrderDetails memory orderDetails = OrderDetails({
            sellToken: _sellToken,
            sellAmount: _sellAmount,
            buyTokensIndex: _buyTokensIndex,
            buyAmounts: _buyAmounts,
            expirationTime: _expirationTime,
            allOrNothing: _allOrNothing
        });

        OrderDetailsWithID memory orderDetailsWithID = OrderDetailsWithID({
            orderID: orderCounter,
            remainingSellAmount: _sellAmount,
            redeemedSellAmount: 0,
            lastUpdateTime: uint64(block.timestamp),
            status: OrderStatus.Active,
            creationProtocolFee: protocolFee,
            orderDetails: orderDetails
        });

        orders[msg.sender].push(orderDetailsWithID);

        UserOrderDetails memory userOrderDetails = UserOrderDetails({
            orderIndex: orders[msg.sender].length - 1,
            orderOwner: msg.sender
        });

        userDetailsByOrderID[orderCounter] = userOrderDetails;

        if (_sellToken == NATIVE_ADDRESS) {
            require(
                remainingValue >= _sellAmount,
                "AgoraX: Insufficient PLS message value"
            );
            uint256 extra = remainingValue - _sellAmount;
            if (extra > 0) {
                _sendNative(extra);
            }
        } else {
            require(
                remainingValue == 0,
                "AgoraX: PLS message value too high. Exceeds expectations for an ERC20 order"
            );
            uint256 sellTokenAmountBefore = IERC20(_sellToken).balanceOf(
                address(this)
            );
            IERC20(_sellToken).safeTransferFrom(
                msg.sender,
                address(this),
                _sellAmount
            );
            uint256 sellTokenAmountAfter = IERC20(_sellToken).balanceOf(
                address(this)
            );
            require(
                sellTokenAmountAfter - sellTokenAmountBefore == _sellAmount,
                "AgoraX: Sell token transfer failed. Verify token has no taxes/fees on transfer"
            );
        }

        _mint(msg.sender, _sellAmount);

        // Track unique user for findFillableOrders
        if (!hasOrders[msg.sender]) {
            userIndexInList[msg.sender] = allUsersWithOrders.length;
            allUsersWithOrders.push(msg.sender);
            hasOrders[msg.sender] = true;
        }

        emit OrderPlaced(
            msg.sender,
            orderCounter,
            _sellToken,
            _sellAmount,
            _buyTokensIndex,
            _buyAmounts,
            _expirationTime,
            _allOrNothing
        );
    }

    /// @notice Cancels an existing order and sends proceeds (if any) to the specified recipient
    /// @notice Refunds for unfilled orders are always returned to the order owner, even if the specified recipient is different
    /// @param _orderID The ID of the order to cancel
    /// @param _recipient Address to send any accumulated proceeds to
    function cancelOrder(
        uint256 _orderID,
        address _recipient
    ) external nonReentrant validOrderID(_orderID) {
        require(
            _recipient != address(0) && _recipient != address(this),
            "AgoraX: Invalid recipient"
        );

        UserOrderDetails memory userOrderDetails = userDetailsByOrderID[
            _orderID
        ];
        require(
            userOrderDetails.orderOwner == msg.sender,
            "AgoraX: Unauthorized"
        );

        OrderDetailsWithID storage orderDetailsWithID = orders[msg.sender][
            userOrderDetails.orderIndex
        ];
        require(
            orderDetailsWithID.status != OrderStatus.Cancelled,
            "AgoraX: Order already cancelled"
        );

        uint256 remainingSellAmount = orderDetailsWithID.remainingSellAmount;
        require(remainingSellAmount > 0, "AgoraX: Order already completed");

        // Collects proceeds from partial fills and sends to the recipient
        uint256 redeemableSell = orderDetailsWithID.orderDetails.sellAmount -
            remainingSellAmount -
            orderDetailsWithID.redeemedSellAmount;
        if (redeemableSell > 0) {
            _collectProceeds(_orderID, _recipient);
        }

        orderDetailsWithID.status = OrderStatus.Cancelled;
        _burn(msg.sender, remainingSellAmount);

        if (orderDetailsWithID.orderDetails.sellToken == NATIVE_ADDRESS) {
            _sendNative(remainingSellAmount);
        } else {
            IERC20(orderDetailsWithID.orderDetails.sellToken).safeTransfer(
                msg.sender,
                remainingSellAmount
            );
        }

        emit OrderCancelled(msg.sender, _orderID);
    }

    /// @notice Cancels all active expired orders (up to 50) for the caller and sends proceeds (if any) to the specified recipient
    /// @notice Refunds for unfilled orders are always returned to the order owner, even if the specified recipient is different
    /// @param _recipient Address to send any accumulated proceeds to
    /// @return cancelledOrderIDs Array of order IDs cancelled
    function cancelAllExpiredOrders(
        address _recipient
    ) external nonReentrant returns (uint256[] memory cancelledOrderIDs) {
        require(
            _recipient != address(0) && _recipient != address(this),
            "AgoraX: Invalid recipient"
        );

        uint256 userOrdersLength = orders[msg.sender].length;
        uint256 cancelledCount = 0;

        // Count cancellable orders to check limit and size the array
        for (uint256 i = 0; i < userOrdersLength; i++) {
            OrderDetailsWithID storage order = orders[msg.sender][i];
            if (
                order.status == OrderStatus.Active &&
                order.orderDetails.expirationTime <= block.timestamp
            ) {
                cancelledCount++;
            }
        }

        require(
            cancelledCount <= 50,
            "AgoraX: Too many expired orders for batch cancellation"
        );

        cancelledOrderIDs = new uint256[](cancelledCount);
        uint256 index = 0;

        // Process cancellations
        for (uint256 i = 0; i < userOrdersLength; i++) {
            OrderDetailsWithID storage order = orders[msg.sender][i];
            if (
                order.status == OrderStatus.Active &&
                order.orderDetails.expirationTime <= block.timestamp
            ) {
                uint256 orderID = order.orderID;
                uint256 redeemableSell = order.orderDetails.sellAmount -
                    order.remainingSellAmount -
                    order.redeemedSellAmount;

                if (redeemableSell > 0) {
                    _collectProceeds(orderID, _recipient); // Collects proceeds from any partially filled orders
                }

                order.status = OrderStatus.Cancelled;
                _burn(msg.sender, order.remainingSellAmount);

                if (order.orderDetails.sellToken == NATIVE_ADDRESS) {
                    _sendNative(order.remainingSellAmount);
                } else {
                    IERC20(order.orderDetails.sellToken).safeTransfer(
                        msg.sender,
                        order.remainingSellAmount
                    );
                }

                cancelledOrderIDs[index] = orderID;
                unchecked {
                    index++;
                }
                emit OrderCancelled(msg.sender, orderID);
            }
        }

        return cancelledOrderIDs;
    }

    /// @notice Fills an order by providing buy tokens in return for sell tokens at the ratio set by the order
    /// @param _orderID The ID of the order to fill
    /// @param _buyTokenIndexInOrder Index of the buy token in the order's buyTokensIndex array
    /// @param _buyAmount Amount of buy tokens to provide
    function fillOrder(
        uint256 _orderID,
        uint256 _buyTokenIndexInOrder,
        uint256 _buyAmount
    ) external payable nonReentrant validActiveOrder(_orderID) whenNotPaused {
        (
            address _buyToken,
            address _sellToken,
            uint256 _soldAmount,
            uint256 _fees
        ) = _fillOrder(_orderID, _buyTokenIndexInOrder, _buyAmount);

        // Handle buy token transfer and fees
        if (_buyToken == NATIVE_ADDRESS) {
            require(
                msg.value >= _buyAmount,
                "AgoraX: Insufficient PLS message value required to fill order"
            );
            uint256 extraTokens = msg.value - _buyAmount;

            if (_fees > 0) {
                _sendNativeToFeeAddress(_fees);
            }

            if (extraTokens > 0) {
                _sendNative(extraTokens);
            }
        } else {
            require(msg.value == 0, "AgoraX: No PLS needed for an ERC20 fill");

            uint256 buyTokenAmountBefore = IERC20(_buyToken).balanceOf(
                address(this)
            );
            IERC20(_buyToken).safeTransferFrom(
                msg.sender,
                address(this),
                _buyAmount
            );
            uint256 buyTokenAmountAfter = IERC20(_buyToken).balanceOf(
                address(this)
            );

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
    /// @param _orderID The ID of the order
    /// @param _recipient Address to send proceeds to (recipient must be able to accept PLS proceeds, if any)
    function collectProceeds(
        uint256 _orderID,
        address _recipient
    ) public nonReentrant validOrderID(_orderID) {
        require(
            _recipient != address(0) && _recipient != address(this),
            "AgoraX: Invalid recipient"
        );
        _collectProceeds(_orderID, _recipient);
    }

    /// @notice Returns collectable proceeds for an order
    /// @param _orderID The ID of the order
    /// @return buyTokens Array of token addresses with collectable proceeds
    /// @return buyAmounts Parallel array of collectable amounts
    function viewCollectableProceeds(
        uint256 _orderID
    )
        external
        view
        validOrderID(_orderID)
        returns (address[] memory buyTokens, uint256[] memory buyAmounts)
    {
        UserOrderDetails memory userDetails = userDetailsByOrderID[_orderID];
        OrderDetailsWithID memory order = orders[userDetails.orderOwner][
            userDetails.orderIndex
        ];

        uint256 originalSellAmount = order.orderDetails.sellAmount;
        uint256 currentFilled = originalSellAmount - order.remainingSellAmount;
        uint256 priorRedemption = order.redeemedSellAmount;

        // Returns empty arrays if no new proceeds since last collection
        if (currentFilled <= priorRedemption) {
            return (new address[](0), new uint256[](0));
        }

        OrderDetails memory details = order.orderDetails;
        uint256 len = details.buyTokensIndex.length;

        address[] memory tempTokens = new address[](len);
        uint256[] memory tempAmounts = new uint256[](len);
        uint256 count = 0;

        for (uint256 i = 0; i < len; ++i) {
            uint256 tokenIndex = details.buyTokensIndex[i];
            (address tokenAddr, ) = getTokenInfoAt(tokenIndex);
            uint256 accumulated = buyTransactionsByOrderID[_orderID][
                tokenIndex
            ];

            if (accumulated == 0) continue;

            tempTokens[count] = tokenAddr;
            tempAmounts[count] = accumulated;
            unchecked {
                ++count;
            }
        }

        // Shrink to exact size
        buyTokens = new address[](count);
        buyAmounts = new uint256[](count);
        for (uint256 i = 0; i < count; ++i) {
            buyTokens[i] = tempTokens[i];
            buyAmounts[i] = tempAmounts[i];
        }
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
    ) external view returns (OrderDetailsWithID[] memory, uint256) {
        uint256 userOrdersLength = orders[_user].length;
        uint256 end = _cursor + _size > userOrdersLength
            ? userOrdersLength
            : _cursor + _size;
        uint256 openCount = 0;

        // Count open (active and not expired) orders within specified range
        for (uint256 i = _cursor; i < end; i++) {
            if (
                orders[_user][i].status == OrderStatus.Active &&
                orders[_user][i].orderDetails.expirationTime > block.timestamp
            ) {
                openCount++;
            }
        }

        OrderDetailsWithID[] memory openOrders = new OrderDetailsWithID[](
            openCount
        );
        uint256 index = 0;

        for (uint256 i = _cursor; i < end && index < openCount; i++) {
            if (
                orders[_user][i].status == OrderStatus.Active &&
                orders[_user][i].orderDetails.expirationTime > block.timestamp
            ) {
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
    ) external view returns (OrderDetailsWithID[] memory, uint256) {
        uint256 userOrdersLength = orders[_user].length;
        uint256 end = _cursor + _size > userOrdersLength
            ? userOrdersLength
            : _cursor + _size;
        uint256 expiredCount = 0;

        // Count expired orders (active but past expiration)
        for (uint256 i = _cursor; i < end; i++) {
            if (
                orders[_user][i].status == OrderStatus.Active &&
                orders[_user][i].orderDetails.expirationTime <= block.timestamp
            ) {
                expiredCount++;
            }
        }

        OrderDetailsWithID[] memory expiredOrders = new OrderDetailsWithID[](
            expiredCount
        );
        uint256 index = 0;

        for (uint256 i = _cursor; i < end && index < expiredCount; i++) {
            if (
                orders[_user][i].status == OrderStatus.Active &&
                orders[_user][i].orderDetails.expirationTime <= block.timestamp
            ) {
                expiredOrders[index] = orders[_user][i];
                unchecked {
                    index++;
                }
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
    ) external view returns (OrderDetailsWithID[] memory, uint256) {
        uint256 userOrdersLength = orders[_user].length;
        uint256 end = _cursor + _size > userOrdersLength
            ? userOrdersLength
            : _cursor + _size;
        uint256 completedCount = 0;

        // Count completed orders in range
        for (uint256 i = _cursor; i < end; i++) {
            if (orders[_user][i].status == OrderStatus.Completed) {
                completedCount++;
            }
        }

        OrderDetailsWithID[] memory completedOrders = new OrderDetailsWithID[](
            completedCount
        );
        uint256 index = 0;

        for (uint256 i = _cursor; i < end && index < completedCount; i++) {
            if (orders[_user][i].status == OrderStatus.Completed) {
                completedOrders[index] = orders[_user][i];
                unchecked {
                    index++;
                }
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
    ) external view returns (OrderDetailsWithID[] memory, uint256) {
        uint256 userOrdersLength = orders[_user].length;
        uint256 end = _cursor + _size > userOrdersLength
            ? userOrdersLength
            : _cursor + _size;
        uint256 cancelledCount = 0;

        // Count cancelled orders in range
        for (uint256 i = _cursor; i < end; i++) {
            if (orders[_user][i].status == OrderStatus.Cancelled) {
                cancelledCount++;
            }
        }

        OrderDetailsWithID[] memory cancelledOrders = new OrderDetailsWithID[](
            cancelledCount
        );
        uint256 index = 0;

        for (uint256 i = _cursor; i < end && index < cancelledCount; i++) {
            if (orders[_user][i].status == OrderStatus.Cancelled) {
                cancelledOrders[index] = orders[_user][i];
                unchecked {
                    index++;
                }
            }
        }

        return (cancelledOrders, end);
    }

    /// @notice Returns the number of expired orders for a user
    /// @param _user The user's address
    /// @return The number of expired orders
    function getUserExpiredOrdersCount(
        address _user
    ) external view returns (uint256) {
        uint256 userOrdersLength = orders[_user].length;
        uint256 expiredCount = 0;

        for (uint256 i = 0; i < userOrdersLength; i++) {
            if (
                orders[_user][i].status == OrderStatus.Active &&
                orders[_user][i].orderDetails.expirationTime <= block.timestamp
            ) {
                unchecked {
                    expiredCount++;
                }
            }
        }

        return expiredCount;
    }

    /// @notice Sets a new expiration time for an order
    /// @dev Only resets the cooldown period if reviving an expired order
    /// @param _orderID The order ID
    /// @param _newExpiration New expiration timestamp
    function updateOrderExpiration(
        uint256 _orderID,
        uint64 _newExpiration
    ) external nonReentrant validOrderID(_orderID) {
        UserOrderDetails memory userDetails = userDetailsByOrderID[_orderID];
        require(userDetails.orderOwner == msg.sender, "AgoraX: Unauthorized");

        OrderDetailsWithID storage orderWithID = orders[msg.sender][
            userDetails.orderIndex
        ];
        require(
            orderWithID.status == OrderStatus.Active,
            "AgoraX: Order not active"
        );

        bool wasExpired = (orderWithID.orderDetails.expirationTime <=
            block.timestamp);

        require(
            _newExpiration > block.timestamp,
            "AgoraX: New expiration time must be in the future"
        );

        orderWithID.orderDetails.expirationTime = _newExpiration;

        if (wasExpired) {
            orderWithID.lastUpdateTime = uint64(block.timestamp);
        }

        emit OrderExpirationUpdated(_orderID, _newExpiration);
    }

    /// @notice Finds fillable orders matching specified criteria
    /// @param _sellToken Sell token to match
    /// @param _minSellAmount Minimum remaining sell amount
    /// @param cursor Starting index for pagination (over users)
    /// @param size Max number of matching orders to return (up to 50)
    /// @return orderIDs Array of matching order IDs (sorted ascending)
    /// @return nextCursor Next starting index for pagination
    function findFillableOrders(
        address _sellToken,
        uint256 _minSellAmount,
        uint256 cursor,
        uint256 size
    ) external view returns (uint256[] memory orderIDs, uint256 nextCursor) {
        require(
            _sellToken != address(0) && _sellToken != address(this),
            "AgoraX: Invalid sell token"
        );
        require(_minSellAmount > 0, "AgoraX: Invalid amount");
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
            OrderDetailsWithID[] storage userOrders = orders[user];

            for (uint256 i = 0; i < userOrders.length && cnt < size; ++i) {
                if (userOrders[i].status != OrderStatus.Active) continue;
                if (userOrders[i].orderDetails.sellToken != _sellToken)
                    continue;
                if (
                    userOrders[i].orderDetails.expirationTime <= block.timestamp
                ) continue;

                uint256 remainingSell = userOrders[i].remainingSellAmount;
                if (remainingSell < _minSellAmount) continue;

                temp[cnt] = userOrders[i].orderID;
                cnt++;
            }
            processed++;
        }

        orderIDs = new uint256[](cnt);
        for (uint256 i = 0; i < cnt; ++i) {
            orderIDs[i] = temp[i];
        }

        // Bubble sort ascending
        for (uint256 i = 0; i < cnt - 1; ++i) {
            for (uint256 j = 0; j < cnt - i - 1; ++j) {
                if (orderIDs[j] > orderIDs[j + 1]) {
                    (orderIDs[j], orderIDs[j + 1]) = (
                        orderIDs[j + 1],
                        orderIDs[j]
                    );
                }
            }
        }

        nextCursor = startUser + processed;
    }

    function _fillOrder(
        uint256 _orderID,
        uint256 _buyTokenIndexInOrder,
        uint256 _buyAmount
    )
        internal
        returns (
            address _buyTokenAddress,
            address _sellTokenAddress,
            uint256 _soldAmount,
            uint256 _fees
        )
    {
        OrderDetailsWithID storage orderDetailsWithID;
        uint256 buyTokenIndex;

        {
            UserOrderDetails memory userOrderDetails = userDetailsByOrderID[
                _orderID
            ];
            orderDetailsWithID = orders[userOrderDetails.orderOwner][
                userOrderDetails.orderIndex
            ];

            require(
                orderDetailsWithID.lastUpdateTime + cooldownPeriod <
                    uint64(block.timestamp),
                "AgoraX: Order still in cooldown period"
            );

            require(
                _buyTokenIndexInOrder <
                    orderDetailsWithID.orderDetails.buyTokensIndex.length,
                "AgoraX: Invalid buy token index"
            );
            buyTokenIndex = orderDetailsWithID.orderDetails.buyTokensIndex[
                _buyTokenIndexInOrder
            ];
            (_buyTokenAddress, ) = getTokenInfoAt(buyTokenIndex);

            uint256 originalBuyAmount = orderDetailsWithID
                .orderDetails
                .buyAmounts[_buyTokenIndexInOrder];
            require(originalBuyAmount > 0, "AgoraX: Invalid buy amount");

            require(
                _buyAmount <= originalBuyAmount,
                "AgoraX: Excessive buy amount"
            );

            uint256 originalSellAmount = orderDetailsWithID
                .orderDetails
                .sellAmount;
            _soldAmount = Math.mulDiv(
                _buyAmount,
                originalSellAmount,
                originalBuyAmount
            );

            require(_soldAmount > 0, "AgoraX: Fill size too small");
            require(
                _soldAmount <= orderDetailsWithID.remainingSellAmount,
                "AgoraX: Exceeds order availability"
            );

            if (orderDetailsWithID.orderDetails.allOrNothing) {
                require(
                    _soldAmount == orderDetailsWithID.remainingSellAmount,
                    "AgoraX: Partial fills not allowed for AON orders"
                );
            }

            orderDetailsWithID.remainingSellAmount -= _soldAmount;

            _sellTokenAddress = orderDetailsWithID.orderDetails.sellToken;

            if (orderDetailsWithID.remainingSellAmount == 0) {
                orderDetailsWithID.status = OrderStatus.Completed;
            }
        }

        // Protocol fee collected as a percentage of proceeds (compares creationProtocolFee and current protocolFee and uses whichever is smallest)
        uint256 effectiveFee = (orderDetailsWithID.creationProtocolFee <
            protocolFee)
            ? orderDetailsWithID.creationProtocolFee
            : protocolFee;

        _fees = (_buyAmount * effectiveFee) / PERCENTAGE_DIVISOR;
        uint256 _newBoughtAmount = _buyAmount > _fees ? _buyAmount - _fees : 0;

        buyTransactionsByOrderID[_orderID][buyTokenIndex] += _newBoughtAmount;

        emit OrderFilled(msg.sender, _orderID, buyTokenIndex, _buyAmount);
    }

    function _collectProceeds(uint256 _orderID, address _recipient) internal {
        UserOrderDetails memory userOrderDetails = userDetailsByOrderID[
            _orderID
        ];
        require(
            userOrderDetails.orderOwner == msg.sender,
            "AgoraX: Unauthorized"
        );

        OrderDetailsWithID storage orderDetailsWithID = orders[msg.sender][
            userOrderDetails.orderIndex
        ];

        uint256 originalSellAmount = orderDetailsWithID.orderDetails.sellAmount;
        uint256 currentFilled = originalSellAmount -
            orderDetailsWithID.remainingSellAmount;
        uint256 redeemableSell = currentFilled -
            orderDetailsWithID.redeemedSellAmount;

        require(redeemableSell > 0, "AgoraX: Nothing to collect");

        // Pre-check if recipient can accept PLS (if order has any PLS proceeds)
        bool hasNative = false;
        for (
            uint256 i = 0;
            i < orderDetailsWithID.orderDetails.buyTokensIndex.length;
            i++
        ) {
            uint256 currentBuyTokenIndex = orderDetailsWithID
                .orderDetails
                .buyTokensIndex[i];
            (address currentBuyToken, ) = getTokenInfoAt(currentBuyTokenIndex);
            uint256 boughtAmount = buyTransactionsByOrderID[_orderID][
                currentBuyTokenIndex
            ];

            if (boughtAmount > 0 && currentBuyToken == NATIVE_ADDRESS) {
                hasNative = true;
                break;
            }
        }

        if (hasNative) {
            (bool canReceive, ) = _recipient.call{value: 0}("");
            require(
                canReceive,
                "AgoraX: Recipient does not accept PLS transfers"
            );
        }

        _burn(msg.sender, redeemableSell);
        orderDetailsWithID.redeemedSellAmount = currentFilled;

        // Collects accumulated buy tokens
        for (
            uint256 i = 0;
            i < orderDetailsWithID.orderDetails.buyTokensIndex.length;
            i++
        ) {
            uint256 currentBuyTokenIndex = orderDetailsWithID
                .orderDetails
                .buyTokensIndex[i];
            (address currentBuyToken, ) = getTokenInfoAt(currentBuyTokenIndex);
            uint256 boughtAmount = buyTransactionsByOrderID[_orderID][
                currentBuyTokenIndex
            ];

            if (boughtAmount > 0) {
                buyTransactionsByOrderID[_orderID][currentBuyTokenIndex] = 0;

                if (currentBuyToken == NATIVE_ADDRESS) {
                    _sendNativeToRecipient(boughtAmount, _recipient);
                } else {
                    IERC20(currentBuyToken).safeTransfer(
                        _recipient,
                        boughtAmount
                    );
                }
            }
        }

        emit OrderProceedsCollected(msg.sender, _orderID);
    }

    function _checkTokenAndAmount(
        uint256[] calldata _tokensIndex,
        uint256[] calldata _amounts
    ) internal view {
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

    function _sendNativeToRecipient(
        uint256 _amount,
        address _recipient
    ) internal {
        (bool sent, ) = payable(_recipient).call{value: _amount}("");
        require(sent, "AgoraX: PLS transfer failed");
    }

    // ========== ADDITIONAL VIEW FUNCTIONS ==========

    /// @notice Returns the current block timestamp in seconds (Unix format)
    /// @return The current timestamp
    function getCurrentTimestamp() external view returns (uint64) {
        return uint64(block.timestamp);
    }

    /// @notice Returns the number of orders for a user
    /// @param _user The user's address
    /// @return The number of orders
    function getUserOrderCount(address _user) external view returns (uint256) {
        return orders[_user].length;
    }

    /// @notice Returns the details of a specific order
    /// @param _orderID The ID of the order
    /// @return The complete order details
    function getOrderDetails(
        uint256 _orderID
    )
        external
        view
        validOrderID(_orderID)
        returns (CompleteOrderDetails memory)
    {
        UserOrderDetails memory userDetails = userDetailsByOrderID[_orderID];
        OrderDetailsWithID memory orderDetailsWithID = orders[
            userDetails.orderOwner
        ][userDetails.orderIndex];
        return
            CompleteOrderDetails({
                userDetails: userDetails,
                orderDetailsWithID: orderDetailsWithID
            });
    }

    /// @notice Returns the total number of orders created
    /// @return The order count
    function getTotalOrderCount() external view returns (uint256) {
        return orderCounter;
    }

    /// @notice Returns the number of unique users tracked for use by findFillableOrders
    /// @return totalUsers Current number of tracked users that have ever placed an order
    /// @return inactiveUsers Number of tracked users with zero AGX balance (eligible for cleanup)
    function trackedUserCounts()
        external
        view
        returns (uint256 totalUsers, uint256 inactiveUsers)
    {
        totalUsers = allUsersWithOrders.length;
        inactiveUsers = 0;

        for (uint256 i = 0; i < totalUsers; ++i) {
            address user = allUsersWithOrders[i];
            if (balanceOf(user) == 0 && hasOrders[user]) {
                ++inactiveUsers;
            }
        }
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
    function transferFrom(
        address,
        address,
        uint256
    ) public pure override returns (bool) {
        revert("AGX: TransferFrom disabled");
    }

    /// @dev AGX receipt tokens have no allowance - overrides parent implementation
    function allowance(
        address,
        address
    ) public pure override returns (uint256) {
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
