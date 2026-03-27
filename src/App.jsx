import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import Home from './Home/Home';
import ReversiGame from './Reversi/ReversiGame';
import './App.css';

function App() {
    return (
        <Router>
            <div className="app">
                <Routes>
                    <Route path="/" element={<Navigate to="/home" replace />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/home/reversi" element={<ReversiGame />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;