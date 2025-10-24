// SPDX-License-Identifier: MIT

// AgoraX is a limit order platform inspired by 0x and OTC contracts, written as an independent implementation under the MIT license.
// Not affiliated with or endorsed by any outside parties.

// Includes: OpenZeppelin 4.9.3 (Ownable2Step, IERC20, ERC20, ReentrancyGuard, SafeERC20 + Address), Whitelist, AgoraX

pragma solidity ^0.8.9;

// ========== CONTEXT ==========
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }
    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }
}

// ========== OWNABLE2STEP ==========
abstract contract Ownable2Step is Context {
    address private _owner;
    address private _pendingOwner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PendingOwnershipTransfer(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        _transferOwnership(initialOwner);
    }

    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    function pendingOwner() public view virtual returns (address) {
        return _pendingOwner;
    }

    function _checkOwner() internal view virtual {
        require(owner() == _msgSender(), "Ownable2Step: caller is not the owner");
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable2Step: new owner is the zero address");
        _pendingOwner = newOwner;
        emit PendingOwnershipTransfer(owner(), newOwner);
    }

    function acceptOwnership() public virtual {
        address sender = _msgSender();
        require(sender == _pendingOwner, "Ownable2Step: caller is not the new owner");
        _transferOwnership(sender);
    }

    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// ========== IERC20 ==========
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

// ========== ERC20 ==========
abstract contract ERC20 is Context, IERC20 {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;
    string private _name;
    string private _symbol;

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    function name() public view virtual returns (string memory) {
        return _name;
    }

    function symbol() public view virtual returns (string memory) {
        return _symbol;
    }

    function decimals() public view virtual returns (uint8) {
        return 18;
    }

    function totalSupply() public view virtual override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view virtual override returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        address owner = _msgSender();
        _transfer(owner, to, amount);
        return true;
    }

    function allowance(address owner, address spender) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal virtual {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");
        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "ERC20: transfer amount exceeds balance");
        unchecked {
            _balances[from] = fromBalance - amount;
            _balances[to] += amount;
        }
        emit Transfer(from, to, amount);
    }

    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");
        _totalSupply += amount;
        unchecked {
            _balances[account] += amount;
        }
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: burn from the zero address");
        uint256 accountBalance = _balances[account];
        require(accountBalance >= amount, "ERC20: burn amount exceeds balance");
        unchecked {
            _balances[account] = accountBalance - amount;
            _totalSupply -= amount;
        }
        emit Transfer(account, address(0), amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal virtual {
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _spendAllowance(address owner, address spender, uint256 amount) internal virtual {
        uint256 currentAllowance = _allowances[owner][spender];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "ERC20: insufficient allowance");
            unchecked {
                _approve(owner, spender, currentAllowance - amount);
            }
        }
    }
}

// ========== REENTRANCYGUARD ==========
abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

// ========== SAFEERC20 + ADDRESS ==========
library SafeERC20 {
    using Address for address;

    function safeTransfer(IERC20 token, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeWithSelector(token.transfer.selector, to, value));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 value) internal {
        _callOptionalReturn(token, abi.encodeWithSelector(token.transferFrom.selector, from, to, value));
    }

    function _callOptionalReturn(IERC20 token, bytes memory data) private {
        bytes memory returndata = address(token).functionCall(data);
        if (returndata.length > 0) {
            require(abi.decode(returndata, (bool)), "SafeERC20: ERC20 operation did not succeed");
        }
    }
}

library Address {
    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, "Address: low-level call failed");
    }

    function functionCallWithValue(address target, bytes memory data, uint256 value, string memory errorMessage) internal returns (bytes memory) {
        require(address(this).balance >= value, "Address: insufficient balance for call");
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return _verifyCallResult(success, returndata, errorMessage);
    }

    function _verifyCallResult(bool success, bytes memory returndata, string memory errorMessage) private pure returns(bytes memory) {
        if (success) {
            return returndata;
        } else {
            if (returndata.length > 0) {
                assembly {
                    revert(add(32, returndata), mload(returndata))
                }
            } else {
                revert(errorMessage);
            }
        }
    }
}

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
        require(whitelistedTokens[realIndex].isActive != _isActive, "Whitelist: Status already set");

        whitelistedTokens[realIndex].isActive = _isActive;
        emit TokenStatusChanged(_address, _isActive);
    }

    /// @notice Returns if an address is actively whitelisted
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

// ========== AGORAX MAIN CONTRACT ==========

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
        uint32 lastUpdateTime;
        OrderStatus status;
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
    uint256 public listingFee; // Fixed amount in PLS (1 PLS = 10^18)
    uint256 public protocolFee; // Percentage in basis points (100 = 1%)
    
    uint256 public constant PERCENTAGE_DIVISOR = 10000;
    uint256 public constant DIVISOR = 10 ** 18;
    uint256 public immutable PROTOCOL_FEES_LIMIT;
    uint256 public immutable LISTING_FEES_LIMIT;

    bool public paused;

    address public constant NATIVE_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    event OrderPlaced(address indexed user, uint256 indexed orderId, address indexed sellToken);
    event OrderCancelled(address indexed user, uint256 indexed orderId);
    event OrderUpdated(uint256 orderId);
    event OrderFilled(address indexed buyer, uint256 indexed orderId, uint256 indexed buyTokenIndex);
    event OrderRedeemed(address indexed user, uint256 indexed orderId);
    event Paused(address indexed owner, bool paused);
    event FeeAddressUpdated(address indexed oldAddress, address indexed newAddress);

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
    ) Ownable2Step(msg.sender) ERC20("AgoraX", "AGX") {
        require(_feeAddress != address(0), "AgoraX: Invalid fee address");
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

    /// @notice Updates the cooldown period for filling orders
    /// @param _newCoolDownPeriod The new cooldown period in seconds
    /// @dev Only callable by the owner
    function updateCoolDownPeriod(uint32 _newCoolDownPeriod) external onlyOwner {
        cooldownPeriod = _newCoolDownPeriod;
    }

    /// @notice Updates the listing fee for placing orders
    /// @param _newFee The new listing fee in PLS (1 PLS = 10^18)
    /// @dev Only callable by the owner
    function updateListingFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= LISTING_FEES_LIMIT, "AgoraX: Listing fee exceeds limit");
        listingFee = _newFee;
    }

    /// @notice Updates the protocol fee for filling orders
    /// @param _newFee The new protocol fee in basis points (100 = 1%)
    /// @dev Only callable by the owner
    function updateProtocolFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= PROTOCOL_FEES_LIMIT, "AgoraX: Protocol fee exceeds limit");
        require(_newFee <= PERCENTAGE_DIVISOR, "AgoraX: Protocol fee cannot exceed 100%");
        protocolFee = _newFee;
    }

    /// @notice Places a new limit order
    /// @param _orderDetails The details of the order (sell token, amount, buy tokens, etc.)
    function placeOrder(OrderDetails calldata _orderDetails) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
    {
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
            orderDetails: _orderDetails
        });
        
        orders[msg.sender].push(orderDetailsWithId);
        UserOrderDetails memory userOrderDetails = UserOrderDetails({
            orderIndex: orders[msg.sender].length - 1,
            orderOwner: msg.sender
        });
        userDetailsByOrderId[orderCounter] = userOrderDetails;
        
        _mint(msg.sender, _orderDetails.sellAmount);

        if (_orderDetails.sellToken == NATIVE_ADDRESS) {
            require(remainingValue >= _orderDetails.sellAmount, "AgoraX: Insufficient PLS balance");
            uint256 extra = remainingValue - _orderDetails.sellAmount;
            if (extra > 0) {
                _sendNative(extra);
            }
        } else {
            require(remainingValue == 0, "AgoraX: No PLS expected for ERC20 sell");
            uint256 sellTokenAmountBefore = IERC20(_orderDetails.sellToken).balanceOf(address(this));
            IERC20(_orderDetails.sellToken).safeTransferFrom(msg.sender, address(this), _orderDetails.sellAmount);
            uint256 sellTokenAmountAfter = IERC20(_orderDetails.sellToken).balanceOf(address(this));
            require(
                sellTokenAmountAfter - sellTokenAmountBefore == _orderDetails.sellAmount,
                "AgoraX: Sell token transfer failed"
            );
        }

        emit OrderPlaced(msg.sender, orderCounter, _orderDetails.sellToken);
    }

    /// @notice Cancels an existing order
    /// @param _orderId The ID of the order to cancel
    function cancelOrder(uint256 _orderId) external nonReentrant validOrderId(_orderId) {
        UserOrderDetails memory userOrderDetails = userDetailsByOrderId[_orderId];
        require(userOrderDetails.orderOwner == msg.sender, "AgoraX: Unauthorized");

        _redeemOrder(_orderId);
        
        OrderDetailsWithId storage orderDetailsWithId = orders[msg.sender][userOrderDetails.orderIndex];
        require(orderDetailsWithId.status != OrderStatus.Cancelled, "AgoraX: Order already cancelled");

        uint256 remainingFillPercentage = orderDetailsWithId.remainingFillPercentage;
        require(remainingFillPercentage > 0, "AgoraX: Order already completed");
        
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

    /// @notice Cancels all expired orders for the caller
    /// @return cancelledOrderIds Array of cancelled order IDs
    function cancelAllExpiredOrders() 
        external 
        nonReentrant 
        returns (uint256[] memory cancelledOrderIds) 
    {
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
                _redeemOrder(orderId); // Redeems partial fills
                
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

    /// @notice Fills an order by providing buy tokens
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
            require(msg.value >= _buyAmount, "AgoraX: Insufficient PLS balance");
            uint256 extraTokens = msg.value - _buyAmount;
            if (_fees > 0) {
                _sendNativeToFeeAddress(_fees);
            }
            if (extraTokens > 0) {
                _sendNative(extraTokens);
            }
        } else {
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

    /// @notice Redeems an order, returning accumulated buy tokens and remaining sell tokens
    /// @param _orderId The ID of the order to redeem
    function redeemOrder(uint256 _orderId) public nonReentrant validOrderId(_orderId) {
        _redeemOrder(_orderId);
    }

    /// @notice Views open (active and not expired) orders for a user
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
        
        // Count open (active and not expired) orders in range
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

    /// @notice Views expired (active but past expiration) orders for a user
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

    /// @notice Views completed orders for a user
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

    /// @notice Views cancelled orders for a user
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
                "AgoraX: Order in cooldown period"
            );

            buyTokenIndex = orderDetailsWithId.orderDetails.buyTokensIndex[_buyTokenIndexInOrder];
            (_buyTokenAddress, ) = getTokenInfoAt(buyTokenIndex);

            uint256 originalBuyAmount = orderDetailsWithId.orderDetails.buyAmounts[_buyTokenIndexInOrder];
            require(originalBuyAmount > 0, "AgoraX: Invalid buy amount");
            
            uint256 percentage = (_buyAmount * DIVISOR) / originalBuyAmount;
            require(orderDetailsWithId.remainingFillPercentage >= percentage, "AgoraX: Insufficient available");

            _soldAmount = (orderDetailsWithId.orderDetails.sellAmount * percentage) / DIVISOR;
            orderDetailsWithId.remainingFillPercentage -= percentage;
            _sellTokenAddress = orderDetailsWithId.orderDetails.sellToken;

            if (orderDetailsWithId.remainingFillPercentage == 0) {
                orderDetailsWithId.status = OrderStatus.Completed;
            }
        }

        // Protocol fee collected as a percentage of proceeds
        _fees = (_buyAmount * protocolFee) / PERCENTAGE_DIVISOR;
        uint256 _newBoughtAmount = _buyAmount > _fees ? _buyAmount - _fees : 0;
        buyTransactionsByOrderId[_orderId][buyTokenIndex] += _newBoughtAmount;

        emit OrderFilled(msg.sender, _orderId, buyTokenIndex);
    }

    function _redeemOrder(uint256 _orderId) internal {
        UserOrderDetails memory userOrderDetails = userDetailsByOrderId[_orderId];
        require(userOrderDetails.orderOwner == msg.sender, "AgoraX: Unauthorized");
        
        OrderDetailsWithId storage orderDetailsWithId = orders[msg.sender][userOrderDetails.orderIndex];
        uint256 redeemable = DIVISOR - orderDetailsWithId.remainingFillPercentage - orderDetailsWithId.redeemedPercentage;
        
        require(redeemable > 0, "AgoraX: Nothing to redeem");

        orderDetailsWithId.redeemedPercentage += redeemable;
        uint256 redeemAmount = (orderDetailsWithId.orderDetails.sellAmount * redeemable) / DIVISOR;
        _burn(msg.sender, redeemAmount);

        // Return accumulated buy tokens
        for (uint256 i = 0; i < orderDetailsWithId.orderDetails.buyTokensIndex.length; i++) {
            uint256 currentBuyTokenIndex = orderDetailsWithId.orderDetails.buyTokensIndex[i];
            (address currentBuyToken, ) = getTokenInfoAt(currentBuyTokenIndex);
            uint256 boughtAmount = buyTransactionsByOrderId[_orderId][currentBuyTokenIndex];
            
            if (boughtAmount > 0) {
                buyTransactionsByOrderId[_orderId][currentBuyTokenIndex] = 0;
                if (currentBuyToken == NATIVE_ADDRESS) {
                    _sendNative(boughtAmount);
                } else {
                    IERC20(currentBuyToken).safeTransfer(msg.sender, boughtAmount);
                }
            }
        }

        emit OrderRedeemed(msg.sender, _orderId);
    }

    function _checkTokenAndAmount(uint256[] calldata _tokensIndex, uint256[] calldata _amounts) internal view {
        require(_tokensIndex.length == _amounts.length, "AgoraX: Array length mismatch");
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

    // ========== VIEW FUNCTIONS ==========

    /// @notice Returns the number of orders for a user
    /// @param _user The user's address
    /// @return The number of orders
    function getUserOrdersLength(address _user) external view returns (uint256) {
        return orders[_user].length;
    }

    /// @notice Returns details of a specific order
    /// @param _orderId The ID of the order
    /// @return The complete order details
    function getOrderDetails(uint256 _orderId) external view validOrderId(_orderId) returns (CompleteOrderDetails memory) {
        UserOrderDetails memory userDetails = userDetailsByOrderId[_orderId];
        OrderDetailsWithId memory orderDetailsWithId = orders[userDetails.orderOwner][userDetails.orderIndex];
        return CompleteOrderDetails({userDetails: userDetails, orderDetailsWithId: orderDetailsWithId});
    }

    /// @notice Returns the total number of orders created
    /// @return The order counter
    function getOrderCounter() external view returns (uint256) {
        return orderCounter;
    }

    /// @notice Returns the fee address for fee collection
    /// @return The fee address
    function getFeeAddress() external view returns (address) {
        return feeAddress;
    }

    /// @notice Returns the cooldown period for filling orders
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

    /// @notice Returns the protocol fee format
    /// @return Description of the protocol fee format
    function getProtocolFeePercentage() external pure returns (string memory) {
        return "Basis points (100 = 1%)";
    }

    // ========== DISABLED ERC20 FUNCTIONS ==========
    /// @dev AGX receipt tokens are non-transferable - overrides parent implementation
    function transfer(address, uint256) public virtual override returns (bool) {
        revert("AGX: Transfer disabled");
    }

    /// @dev AGX receipt tokens cannot be approved - overrides parent implementation
    function approve(address, uint256) public virtual override returns (bool) {
        revert("AGX: Approve disabled");
    }

    /// @dev AGX receipt tokens cannot be transferred from - overrides parent implementation
    function transferFrom(address, address, uint256) public virtual override returns (bool) {
        revert("AGX: TransferFrom disabled");
    }

    /// @dev AGX receipt tokens have no allowance - overrides parent implementation
    function allowance(address, address) public view virtual override returns (uint256) {
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