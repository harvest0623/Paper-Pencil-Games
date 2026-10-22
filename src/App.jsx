import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import Home from './Home/Home';
import ReversiGame from './Reversi/ReversiGame';
import GomokuGame from './Gomoku/GomokuGame';
import TicTacToeGame from './Tic-Tac-Toe/TicTacToeGame';
import SudokuGame from './Sudoku/SudokuGame';
import HuarongdaoGame from './Huarongdao/HuarongdaoGame';
import MinesweeperGame from './Minesweeper/MinesweeperGame';
import MancalaGame from './Mancala/MancalaGame';
import SuperTicTacToeGame from './SuperTicTacToe/SuperTicTacToeGame';
import ConnectFourGame from './ConnectFour/ConnectFourGame';
import DotsAndBoxesGame from './DotsAndBoxes/DotsAndBoxesGame';
import BattleshipGame from './Battleship/BattleshipGame';
import NineMensMorrisGame from './NineMensMorris/NineMensMorrisGame';
import NonogramGame from './Nonogram/NonogramGame';
import KakuroGame from './Kakuro/KakuroGame';
import SlitherlinkGame from './Slitherlink/SlitherlinkGame';
import Game2048Game from './Game2048/Game2048Game';
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
                <Route path="/home/huarongdao" element={<HuarongdaoGame />} />
                <Route path="/home/minesweeper" element={<MinesweeperGame />} />
                <Route path="/home/mancala" element={<MancalaGame />} />
                <Route path="/home/super-tictactoe" element={<SuperTicTacToeGame />} />
                <Route path="/home/connect-four" element={<ConnectFourGame />} />
                <Route path="/home/dots-and-boxes" element={<DotsAndBoxesGame />} />
                <Route path="/home/battleship" element={<BattleshipGame />} />
                <Route path="/home/nine-mens-morris" element={<NineMensMorrisGame />} />
                <Route path="/home/nonogram" element={<NonogramGame />} />
                <Route path="/home/kakuro" element={<KakuroGame />} />
                <Route path="/home/slitherlink" element={<SlitherlinkGame />} />
                <Route path="/home/2048" element={<Game2048Game />} />
            </Routes>
        </Router>
    );
}

export default App;