import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import Home from './Home/Home';
import ReversiGame from './Reversi/ReversiGame';
import TicTacToeGame from './Tic-Tac-Toe/TicTacToeGame';
import './App.css';

function App() {
    return (
        <Router>
            <div className="app">
                <Routes>
                    <Route path="/" element={<Navigate to="/home" replace />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/home/reversi" element={<ReversiGame />} />
                    <Route path="/home/tic-tac-toe" element={<TicTacToeGame />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;