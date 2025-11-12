// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import './App.css';
import { getRestaurants, getRestaurantMenu, createOrder, getOrderById } from './api';

function App() {
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [lastOrder, setLastOrder] = useState(null);
  const [orderStatus, setOrderStatus] = useState('');

  useEffect(() => {
    getRestaurants()
      .then((res) => setRestaurants(res.data))
      .catch((err) => console.error('Error fetching restaurants:', err));
  }, []);

  const handleSelectRestaurant = (restaurant) => {
    setSelectedRestaurant(restaurant);
    setCart([]);

    getRestaurantMenu(restaurant._id)
      .then((res) => setMenu(res.data))
      .catch((err) => console.error('Error fetching menu:', err));
  };

  const addToCart = (item) => {
    const existing = cart.find((c) => c.itemName === item.itemName);
    if (existing) {
      setCart(cart.map((c) => (c.itemName === item.itemName ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const cartTotal = cart.reduce((t, i) => t + i.price * i.quantity, 0);

  const handlePlaceOrder = () => {
    if (!selectedRestaurant) return alert('Hãy chọn nhà hàng trước');
    if (cart.length === 0) return alert('Vui lòng thêm món vào giỏ hàng!');

    const orderData = {
      userId: 'user-123-test',
      restaurantId: selectedRestaurant._id,
      items: cart.map((i) => ({ itemName: i.itemName, quantity: i.quantity })),
      totalPrice: cartTotal,
    };

    createOrder(orderData)
      .then((res) => {
        setLastOrder(res.data);
        setOrderStatus(res.data.status);
        setCart([]);
        setMenu([]);
        setSelectedRestaurant(null);
        trackOrderStatus(res.data._id);
        alert(`Đặt hàng thành công! Mã đơn: ${res.data._id}`);
      })
      .catch((err) => console.error('Error placing order:', err));
  };

  const trackOrderStatus = (orderId) => {
    const iv = setInterval(() => {
      getOrderById(orderId)
        .then((res) => {
          const s = res.data.status;
          setOrderStatus(s);
          if (s === 'DELIVERED') {
            clearInterval(iv);
            alert(`Đơn hàng ${orderId} đã giao thành công!`);
          }
        })
        .catch((err) => {
          console.error('Error tracking order:', err);
          clearInterval(iv);
        });
    }, 5000);
  };

  if (lastOrder && orderStatus !== 'DELIVERED') {
    return (
      <div className="App">
        <h1>Đang theo dõi đơn hàng...</h1>
        <h2>Mã đơn: {lastOrder._id}</h2>
        <h3>Trạng thái: {orderStatus}</h3>
        <p>(PENDING - CONFIRMED - OUT_FOR_DELIVERY - DELIVERED)</p>
      </div>
    );
  }

  if (selectedRestaurant) {
    return (
      <div className="App">
        <button onClick={() => setSelectedRestaurant(null)}>{'<'} Quay lại</button>
        <h2>{selectedRestaurant.name}</h2>

        <div className="container">
          <div className="menu">
            <h3>Menu</h3>
            {menu.map((item) => (
              <div key={item.itemName} className="item">
                {item.itemName} (${item.price})
                <button onClick={() => addToCart(item)}>+</button>
              </div>
            ))}
          </div>

          <div className="cart">
            <h3>Giỏ hàng</h3>
            {cart.map((item) => (
              <div key={item.itemName} className="item">
                {item.itemName} x {item.quantity} (${item.price * item.quantity})
              </div>
            ))}
            <hr />
            <h4>Tổng tiền: ${cartTotal}</h4>
            <button onClick={handlePlaceOrder}>Đặt hàng</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <h1>Chọn nhà hàng</h1>
      {restaurants.map((r) => (
        <div key={r._id} className="restaurant" onClick={() => handleSelectRestaurant(r)}>
          {r.name}
        </div>
      ))}
    </div>
  );
}

export default App;
