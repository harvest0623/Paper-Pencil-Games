import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Board from './components/Board';
import {
    createInitialBoard,
    getValidMoves,
    makeMove,
    countPieces,
    isGameOver,
    BLACK,
    WHITE
} from './utils/gameLogic';
import { getAIMove } from './utils/ai';

function ReversiGame() {
    const [gameState, setGameState] = useState('menu');
    const [board, setBoard] = useState(createInitialBoard());
    const [currentPlayer, setCurrentPlayer] = useState(BLACK);
    const [gameMode, setGameMode] = useState('ai');
    const [difficulty, setDifficulty] = useState('medium');
    const [message, setMessage] = useState('');

    const validMoves = getValidMoves(board, currentPlayer);
    const scores = countPieces(board);

    const resetGame = useCallback(() => {
        setBoard(createInitialBoard());
        setCurrentPlayer(BLACK);
        setMessage('');
        setGameState('playing');
    }, []);

    const handleMove = useCallback((row, col) => {
        const newBoard = makeMove(board, row, col, currentPlayer);
        if (!newBoard) return;

        setBoard(newBoard);
        
        const nextPlayer = currentPlayer === BLACK ? WHITE : BLACK;
        const nextValidMoves = getValidMoves(newBoard, nextPlayer);
        
        if (nextValidMoves.length === 0) {
            const currentPlayerValidMoves = getValidMoves(newBoard, currentPlayer);
            if (currentPlayerValidMoves.length === 0) {
                setGameState('gameOver');
            } else {
                setMessage(`${nextPlayer === BLACK ? '黑棋' : '白棋'}无法落子，跳过`);
                setTimeout(() => setMessage(''), 1500);
            }
        } else {
            setCurrentPlayer(nextPlayer);
        }
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
            if (currentPlayer !== WHITE) return;

            const timer = setTimeout(() => {
                const aiMove = getAIMove(board, WHITE, difficulty);
                if (aiMove) {
                    handleMove(aiMove.row, aiMove.col);
                }
            }, 800);

            return () => clearTimeout(timer);
        }, [board, currentPlayer, gameState, gameMode, difficulty, handleMove]);

        const getGameResult = () => {
            const { black, white } = scores;
            if (black > white) return '黑棋获胜！';
            if (white > black) return '白棋获胜！';
            return '平局！';
        };

        const startGame = (mode) => {
            setGameMode(mode);
            resetGame();
        };

        const goToMenu = () => {
            setGameState('menu');
            setBoard(createInitialBoard());
            setCurrentPlayer(BLACK);
        };

    return (
        <div className="app">
            <header className="header">
                <div className="header-content">
                    <Link to="/home" className="back-btn">
                        ← 返回首页
                    </Link>
                    <div className="header-title">
                        <h1>黑白棋</h1>
                        <p className="subtitle">Reversi / Othello</p>
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
                        <div className={`score-item ${currentPlayer === BLACK ? 'active' : ''}`}>
                            <div className="piece-display black-piece"></div>
                            <span className="score-label">黑棋</span>
                            <span className="score-value">{scores.black}</span>
                        </div>
                        <div className="score-divider">vs</div>
                        <div className={`score-item ${currentPlayer === WHITE ? 'active' : ''}`}>
                            <div className="piece-display white-piece"></div>
                            <span className="score-label">白棋</span>
                            <span className="score-value">{scores.white}</span>
                        </div>
                    </div>

                  <div className="game-status">
                        {message ? (
                            <p className="message">{message}</p>
                        ) : gameState === 'gameOver' ? (
                            <p className="result">{getGameResult()}</p>
                        ) : (
                            <p className="turn">
                                {currentPlayer === BLACK ? '黑棋' : '白棋'}的回合
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

export default ReversiGame;