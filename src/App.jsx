import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import Home from './Home/Home';
import ReversiGame from './Reversi/ReversiGame';
import GomokuGame from './Gomoku/GomokuGame';
import TicTacToeGame from './Tic-Tac-Toe/TicTacToeGame';
import SudokuGame from './Sudoku/SudokuGame';
import ScrollToTop from './components/ScrollToTop';

function App() {
    return (
        <Router>
            <ScrollToTop />
            <Routes>
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<Home />} />
                <Route path="/home/reversi" element={<ReversiGame />} />
                <Route path="/home/gomoku" element={<GomokuGame />} />
                <Route path="/home/tic-tac-toe" element={<TicTacToeGame />} />
                <Route path="/home/sudoku" element={<SudokuGame />} />
            </Routes>
        </Router>
    );
}

export default App;