import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Code2,
  Bug,
  Trophy,
  BookOpen,
  ChevronRight,
  ThumbsUp,
  Terminal,
  PlayCircle,
  XCircle,
  CheckCircle,
  PartyPopper,
  SettingsIcon as Confetti,
  Wand2
} from 'lucide-react';
import { challengesData } from './challengesData';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { indentUnit } from '@codemirror/language';


function SuccessModal({ message, onClose }) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full mx-4 relative overflow-hidden">
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <div className="relative">
            <Confetti className="w-12 h-12 text-yellow-400 animate-bounce" />
            <PartyPopper
              className="w-12 h-12 text-pink-500 absolute top-0 left-0 animate-ping"
              style={{ animationDuration: '2s' }}
            />
          </div>
        </div>

        <div className="text-center mt-8">
          <h2 className="text-3xl font-bold text-slate-800 mb-4">{message}</h2>

          <div className="flex flex-col gap-4 mt-8">
            <button
              onClick={() => navigate('/')}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 font-medium"
            >
              他の課題にチャレンジする
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="text-slate-600 hover:text-slate-800 transition"
            >
              現在の課題を続ける
            </button>
          </div>
        </div>

        <div className="mt-8 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-4 rounded-lg text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8" />
              <div>
                <div className="font-medium">経験値UP!</div>
                <div className="text-sm opacity-90">Python Master Level 1</div>
              </div>
            </div>
            <div className="text-2xl font-bold">+100 XP</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HintModal({ hint, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl w-full mx-4 relative animate-pop-in">
        <div className="flex flex-col">
          <div className="flex items-start gap-4">
            {/* Character image */}
            <div className="w-40 h-63 flex-shrink-0">
              <img 
                src="/images/character.png" 
                alt="Debug Master Character" 
                className="w-full h-full object-contain"
              />
            </div>
            
            {/* Speech bubble */}
            <div className="flex-1 bg-indigo-50 rounded-2xl p-5 relative">
              {/* Speech bubble tail */}
              <div className="absolute top-1/2 left-0 w-4 h-4 bg-indigo-50 transform translate-y-[-50%] translate-x-[-50%] rotate-45"></div>
              
              <h2 className="text-xl font-bold text-indigo-800 mb-3">ヒント</h2>
              <div className="text-slate-700 whitespace-pre-wrap mb-4">
                {hint}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 text-sm font-medium"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

function ChallengeEditor() {
  const navigate = useNavigate();
  const { themeId } = useParams();
  const challenge = challengesData.find((c) => c.id === themeId);

  useEffect(() => {
    if (!challenge) {
      navigate('/');
    }
  }, [challenge, navigate]);

  const [code, setCode] = useState(`def main(numbers):
    # Write your solution here
    pass
  `);
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [generationError, setGenerationError] = useState('');
  const [showHintModal, setShowHintModal] = useState(false);
  const [hint, setHint] = useState('');
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [hintError, setHintError] = useState('');

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    setGenerationError(''); // Reset any previous error message

    try {
      const response = await fetch('http://localhost:8000/api/generate-code', {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();
      console.log('Generated code response:', data);

      // If the server returns an error status or an error field, handle it:
      if (!response.ok || data.error) {
        setGenerationError(data.error || 'An unknown error occurred.');
        return; // Stop here if there's an error
      }

       // If everything is okay and 'code' exists, set it in the editor
      if (data.code) {
        setCode(data.code);
      }
    } catch (error) {
      console.error('Error generating code: ', error);
      // In case of network failure, etc.
      setGenerationError('Failed to connect to code generation service.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunCode = async () => {
    if (!challenge) return;
    setIsRunning(true);
    setTestResults([]);

    try {
      const response = await fetch('http://localhost:8000/api/run-python', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          testCases: challenge.testCases,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              setTestResults((prev) => [...prev, data]);
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
        buffer = lines[lines.length - 1];
      }
    } catch (error) {
      console.error('Error running code:', error);
      setTestResults([
        {
          testCase: 1,
          status: 'error',
          message:
            'Failed to connect to Python server. Please make sure the server is running.',
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmitSolution = () => {
    const allTestsPassed = testResults.every(
      (result) => result.status === 'success'
    );
    if (allTestsPassed) {
      setShowSuccessModal(true);
    }
  };

  const getPassingTestsCount = () => {
    return testResults.filter((result) => result.status === 'success').length;
  };
  
  const handleShowHint = async () => {
    setIsLoadingHint(true);
    setHintError('');
    
    try {
      const response = await fetch('http://localhost:8000/api/generate-hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          instructions: challenge.instructions,
          examples: challenge.examples,
          testResults,
        }),
      });
      console.log('Generated hint response:', response);
      
      const data = await response.json();
      
      if (!response.ok || data.error) {
        setHintError(data.error || 'ヒントの生成中にエラーが発生しました。');
        return;
      }
      
      setHint(data.hint);
      setShowHintModal(true);
    } catch (error) {
      console.error('Error generating hint:', error);
      setHintError('ヒント生成サービスへの接続に失敗しました。');
    } finally {
      setIsLoadingHint(false);
    }
  };

  if (!challenge) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col relative">
      {showSuccessModal && (
        <SuccessModal
          message="おめでとう！バグ修正に成功 🎉"
          onClose={() => setShowSuccessModal(false)}
        />
      )}
      {showHintModal && (
        <HintModal
          hint={hint}
          onClose={() => setShowHintModal(false)}
        />
      )}

      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bug className="w-6 h-6 text-indigo-600" />
            <span className="text-xl font-bold text-slate-800">Debug Master</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-slate-600">
              <Trophy className="w-5 h-5" />
              <span>スコア: 2,450</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* サイドバー */}
        <div className="w-96 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              課題
            </h2>
            <pre className="font-sans whitespace-pre-wrap">
              {challenge.instructions}
            </pre>
          </div>

          <div className="flex-1 p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">テストケース例：</h3>
            <pre className="bg-slate-100 p-3 rounded text-sm font-mono whitespace-pre-wrap">
              {challenge.examples}
            </pre>

            <video
              className="mt-4 w-full max-w-md rounded shadow"
              controls
            >
              <source src={challenge.video} type="video/mp4" />
              お使いのブラウザは動画タグに対応していません。
            </video>

            <div className="mt-4 flex justify-center relative">
              <img 
                src="/images/character.png" 
                alt="ヒントキャラクター" 
                className="w-40 h-63 object-cover cursor-pointer hover:opacity-60 transition hover:scale-105 transform duration-300"
                onClick={handleShowHint}
                style={{pointerEvents: isLoadingHint ? 'none' : 'auto' }}
              />
              {isLoadingHint && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {hintError && (
                <div className="absolute top-full left-0 mt-2 text-red-600 text-sm font-medium bg-red-50 px-3 py-1 rounded">
                  {hintError}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 bg-white border-b border-slate-200">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-2">
                <Wand2 className="w-5 h-5 text-indigo-600" />
                まずは、AIアシスタントを使ってコードを生成しよう！
              </h2>
              <p className="text-slate-600 text-sm mb-4">
                プロンプトを使ってAIにコードを書かせて、<br />
                生成されたコードを修正してテストを実行しよう！
              </p>

              <label className="block mb-1 font-medium text-slate-700 text-sm">
                AIへの指示
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="AIにさせたい処理を具体的に入力してください..."
                className="w-full p-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={3}
              />

              <button
                onClick={handleGenerateCode}
                disabled={isGenerating}
                className="mt-3 bg-indigo-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-indigo-700 transition"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    生成中...
                  </>
                ) : (
                  'コードを生成'
                )}
              </button>

              {/* Display an error if code generation failed */}
              {generationError && (
                <div className="mt-3 text-red-600 font-bold">
                  ⚠️コード生成時にエラーが発生しました。プロンプトを変更して再度お試しください。
                </div>
              )}
            </div>
          </div>

          {/* エディタ & テスト結果 */}
          <div className="flex-1 grid grid-cols-2 gap-0">
            {/* コードエディタ */}
            <div className="h-full flex flex-col">
              <div className="bg-slate-800 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Code2 className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-200">main.py</span>
                </div>
              </div>
              <div className="flex-1 p-4 bg-slate-900">
                <CodeMirror
                  value={code}
                  height="100%"
                  extensions={[python(), oneDark, indentUnit.of('    ')]}
                  onChange={(value) => setCode(value)}
                  className="w-full h-full font-mono text-sm bg-transparent text-slate-200 outline-none resize-none"
                />
              </div>
            </div>

            {/* テスト結果 */}
            <div className="h-full flex flex-col border-l border-slate-700">
              <div className="bg-slate-800 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-5 h-5 text-slate-400" />
                  <span className="text-slate-200">テスト結果</span>
                </div>
                <button
                  onClick={handleRunCode}
                  disabled={isRunning}
                  className={`flex items-center gap-2 px-3 py-1 rounded ${
                    isRunning
                      ? 'bg-slate-700 text-slate-400'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  } text-sm transition`}
                >
                  {isRunning ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-4 h-4" />
                      テスト実行
                    </>
                  )}
                </button>
              </div>
              <div className="flex-1 p-4 bg-slate-900 font-mono text-sm overflow-auto">
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className={`mb-4 p-3 rounded ${
                      result.status === 'success' ? 'bg-green-950' : 'bg-red-950'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {result.status === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-green-500 mt-1" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 mt-1" />
                      )}
                      <div>
                        <div
                          className={`font-medium ${
                            result.status === 'success'
                              ? 'text-green-500'
                              : 'text-red-500'
                          }`}
                        >
                          Test Case {result.testCase}
                        </div>
                        <div className="text-slate-300 mt-1 whitespace-pre-wrap">
                          {result.status === 'forbidden'
                            ? 'APIキーを抜き取ろうとするコードは許可されていません！'
                            : result.message}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {testResults.length === 0 && (
                  <div className="text-slate-400">
                    コードが正しいかを確認するには「テスト実行」ボタンをクリックしてください。
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* フッターの提出ボタンなど */}
          <div className="bg-white border-t border-slate-200 p-4">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div className="relative">
                {/* Hint button moved to sidebar */}
              </div>
              <div className="flex items-center gap-4">
                {testResults.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <ThumbsUp className="w-4 h-4" />
                    <span>
                      {getPassingTestsCount()}/{testResults.length} Tests Passing
                    </span>
                  </div>
                )}
                <button
                  onClick={handleSubmitSolution}
                  disabled={
                    testResults.length === 0 ||
                    getPassingTestsCount() !== testResults.length
                  }
                  className={`px-6 py-2 rounded-lg flex items-center gap-2 ${
                    testResults.length === 0 ||
                    getPassingTestsCount() !== testResults.length
                      ? 'bg-slate-100 text-slate-400'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  } transition`}
                >
                  回答を提出する
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChallengeEditor;
