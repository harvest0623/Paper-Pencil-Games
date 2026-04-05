import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import {
    createInitialBoard,
    getValidMoves,
    makeMove,
    checkWinner,
    isGameOver,
    X,
    O
} from './utils/gameLogic';
import { getAIMove } from './utils/ai';

function TicTacToeGame() {
    const [gameState, setGameState] = useState('menu');
    const [board, setBoard] = useState(createInitialBoard());
    const [currentPlayer, setCurrentPlayer] = useState(X);
    const [gameMode, setGameMode] = useState('ai');
    const [difficulty, setDifficulty] = useState('medium');
    const [message, setMessage] = useState('');

    const validMoves = getValidMoves(board);
    const winner = checkWinner(board);

    const resetGame = useCallback(() => {
        setBoard(createInitialBoard());
        setCurrentPlayer(X);
        setMessage('');
        setGameState('playing');
    }, []);

    const handleMove = useCallback((row, col) => {
        const newBoard = makeMove(board, row, col, currentPlayer);
        if (!newBoard) return;

        setBoard(newBoard);
        
        const newWinner = checkWinner(newBoard);
        if (newWinner) {
            setGameState('gameOver');
            return;
        }

        if (isGameOver(newBoard)) {
            setGameState('gameOver');
            return;
        }

        const nextPlayer = currentPlayer === X ? O : X;
        setCurrentPlayer(nextPlayer);
      }, [board, currentPlayer]);

      useEffect(() => {
            if (gameState !== 'playing') return;
            if (isGameOver(board)) {
                setGameState('gameOver');
                return;
            }
      }, [board, gameState]);

      useEffect(() => {
            if (gameState !== 'playing' || gameMode !== 'ai') return;
            if (currentPlayer !== O) return;

            const timer = setTimeout(() => {
                const aiMove = getAIMove(board, O, difficulty);
                if (aiMove) {
                    handleMove(aiMove.row, aiMove.col);
                }
            }, 800);

            return () => clearTimeout(timer);
        }, [board, currentPlayer, gameState, gameMode, difficulty, handleMove]);

        const getGameResult = () => {
            if (winner === X) return 'X获胜！';
            if (winner === O) return 'O获胜！';
            return '平局！';
        };

        const startGame = (mode) => {
            setGameMode(mode);
            resetGame();
        };

        const goToMenu = () => {
            setGameState('menu');
            setBoard(createInitialBoard());
            setCurrentPlayer(X);
        };

    return (
        <div className="app">
            <header className="header">
                <div className="header-content">
                    <Link to="/home" className="back-btn">
                        ← 返回首页
                    </Link>
                    <div className="header-title">
                        <h1>井字棋</h1>
                        <p className="subtitle">Tic-Tac-Toe</p>
                    </div>
                    <div style={{ width: '120px' }}></div>
                </div>
            </header>

            {gameState === 'menu' && (
                <div className="menu">
                    <h2>选择游戏模式</h2>
                    <div className="mode-buttons">
                        <button className="btn btn-primary" onClick={() => startGame('ai')}>
                            玩家 vs 电脑
                        </button>
                        <button className="btn btn-secondary" onClick={() => startGame('pvp')}>
                            玩家 vs 玩家
                        </button>
                    </div>

                <div className="difficulty-selector">
                    <h3>难度选择</h3>
                    <div className="difficulty-buttons">
                        <button 
                            className={`btn ${difficulty === 'easy' ? 'btn-active' : ''}`}
                            onClick={() => setDifficulty('easy')}
                        >
                            简单
                        </button>
                        <button 
                            className={`btn ${difficulty === 'medium' ? 'btn-active' : ''}`}
                            onClick={() => setDifficulty('medium')} 
                        >
                            中等
                        </button>
                        <button 
                            className={`btn ${difficulty === 'hard' ? 'btn-active' : ''}`}
                            onClick={() => setDifficulty('hard')}
                        >
                            困难
                        </button>
                    </div>  
                </div>
              </div>
          )}

          {(gameState === 'playing' || gameState === 'gameOver') && (
            <div className="game-container">
                <div className="game-info">
                    <div className="scoreboard">
                        <div className={`score-item ${currentPlayer === X ? 'active' : ''}`}>
                            <div className="piece-display x-piece">X</div>
                            <span className="score-label">X</span>
                        </div>
                        <div className="score-divider">vs</div>
                        <div className={`score-item ${currentPlayer === O ? 'active' : ''}`}>
                            <div className="piece-display o-piece">O</div>
                            <span className="score-label">O</span>
                        </div>
                    </div>

                  <div className="game-status">
                        {message ? (
                            <p className="message">{message}</p>
                        ) : gameState === 'gameOver' ? (
                            <p className="result">{getGameResult()}</p>
                        ) : (
                            <p className="turn">
                                {currentPlayer === X ? 'X' : 'O'}的回合
                            </p>
                        )}  
                  </div>
                </div>

                <div className="board-container">
                    <Board 
                      board={board}
                      validMoves={validMoves}
                      currentPlayer={currentPlayer}
                      onCellClick={handleMove}
                    />
                </div>

                <div className="game-controls">
                    <button className="btn btn-control" onClick={resetGame}>
                        重新开始
                    </button>
                    <button className="btn btn-control" onClick={goToMenu}>
                        返回菜单
                    </button> 
                </div>
              </div>
            )}
        </div>
    );
}

export default TicTacToeGame;