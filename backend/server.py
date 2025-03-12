import http.server
import io
import json
import os
import random
import socketserver
import traceback
from contextlib import redirect_stdout
from http import HTTPStatus
from typing import Any, Dict, List

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
SYSTEM_INSTRUNCTION: str = """\
Below is a Python programming problem. 
Reason about **what kind of bugs students may make** while coming up with solutions for the given problem. Next, come up with exactly 3 buggy implementations, their corrected versions, and explanations for the bugs. Format it as a JSON object, where each object contains the following keys: ‘code’, ‘fixed_code’, and ‘explanation’:
{
"reasoning": "Reasoning about the bugs",
"content":
[{ "code": ...,
"fixed_code": ...,
"explanation": ... }]
}
Implement only this function with various bugs that students may make, incorporating the bugs you reasoned about. Each program should contain only one bug. Make them as diverse as possible. The bugs should not lead to the program not compiling or hanging. Do not add comments.  Do not forget to first reason about possible bugs. 
Make sure that the function name is `main`.
Problem Description: 
"""


class TestHandler(http.server.SimpleHTTPRequestHandler):
    """
    A handler that provides:
      - /api/health                (GET)
      - /api/run-python            (POST)
      - /api/generate-code         (POST)
      - CORS preflight handling    (OPTIONS)
    """

    def do_GET(self) -> None:
        if self.path == "/api/health":
            self.send_json_response({"status": "OK"})
            return
        return super().do_GET()

    def do_POST(self) -> None:
        if self.path == "/api/run-python":
            data_run: Dict[str, Any] = self.parse_json_from_request()
            code: str = data_run.get("code", "")
            test_cases: List[Dict[str, Any]] = data_run.get("testCases", [])

            self.send_sse_headers()
            self.run_tests_with_sse(code, test_cases)
            return

        elif self.path == "/api/generate-code":
            data_gen: Dict[str, Any] = self.parse_json_from_request()
            prompt: str = data_gen.get("prompt", "")
            try:
                generated_code: str = self.generate_code_from_prompt(prompt)
                self.send_json_response({"code": generated_code})
            except json.JSONDecodeError as e:
                self.send_json_response({"error": str(e)}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Not Found")

    def do_OPTIONS(self) -> None:
        """
        CORS preflight request handler
        """
        self.send_response(HTTPStatus.NO_CONTENT)
        self.set_cors_headers()
        self.end_headers()

    # ---------------------------
    # Common utility / helper methods
    # ---------------------------

    def parse_json_from_request(self) -> Dict[str, Any]:
        """
        POSTデータを読み取り、JSONオブジェクトとして返す
        """
        content_length: int = int(self.headers.get("Content-Length", 0))
        post_data: bytes = self.rfile.read(content_length)
        return json.loads(post_data.decode("utf-8"))

    def send_json_response(self, data: Dict[str, Any], status: int = HTTPStatus.OK) -> None:
        """
        JSON形式のレスポンスを返す
        """
        self.send_response(status)
        self.set_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        response: str = json.dumps(data)
        self.wfile.write(response.encode("utf-8"))

    def send_sse_headers(self) -> None:
        """
        SSE (Server-Sent Events) 向けのヘッダを送信する
        """
        self.send_response(HTTPStatus.OK)
        self.set_cors_headers()
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()

    def set_cors_headers(self) -> None:
        """
        CORS用の共通ヘッダを設定する
        """
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    # ---------------------------
    # /api/generate-code endpoint logic
    # ---------------------------

    def generate_code_from_prompt(self, prompt: str) -> str:
        """
        受け取ったプロンプトに応じてコードを生成する処理
        """
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[prompt],
            config=types.GenerateContentConfig(
                temperature=0.0,
                system_instruction=SYSTEM_INSTRUNCTION,
                response_mime_type="application/json",
            ),
        )

        response_json: Dict[str, Any] = json.loads(response.text)
        selected_idx: int = random.randint(0, len(response_json["content"]) - 1)
        generated_code: str = response_json["content"][selected_idx]["code"]
        return generated_code

    # ---------------------------
    # /api/run-python endpoint logic
    # ---------------------------
    def run_tests_with_sse(self, code: str, test_cases: List[Dict[str, Any]]) -> None:
        """
        送信されてきた test_cases を使ってテスト
        """
        if "GEMINI_API_KEY" in code:
            error_response = json.dumps({
                "status": "forbidden",
                "message": "Execution halted: Code contains forbidden string 'GEMINI_API_KEY'."
            })
            self.write_sse_data(error_response)
            return
        for i, test_case in enumerate(test_cases):
            result: Dict[str, Any] = self.run_single_test_case(code, test_case)
            response: str = json.dumps({
                "status": "ok",
                "testCase": i + 1,
                **result,
            })
            self.write_sse_data(response)

    def run_single_test_case(self, code: str, test_case: Dict[str, Any]) -> Dict[str, Any]:
        stdout: io.StringIO = io.StringIO()
        try:
            namespace: Dict[str, Any] = {}
            exec(code, namespace)
            solution = namespace.get("main")
            if not solution:
                return {
                    "status": "error",
                    "message": 'Function "main" not found in code',
                }
            with redirect_stdout(stdout):
                result = solution(*test_case["input"])
            expected = test_case["expected"]
            if result == expected:
                return {
                    "status": "success",
                    "message": f"Input:\n{test_case['input']}\n\nExpected:\n{expected}\n\nGot:\n{result}",
                }
            else:
                return {
                    "status": "error",
                    "message": f"Input:\n{test_case['input']}\n\nExpected:\n{expected}\n\nGot:\n{result}",
                }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error:\n\n{str(e)}\n{traceback.format_exc()}",
            }

    def write_sse_data(self, data: str) -> None:
        """
        SSE形式でクライアントへデータを送信する
        """
        self.wfile.write(f"data: {data}\n\n".encode("utf-8"))
        self.wfile.flush()


if __name__ == "__main__":
    PORT: int = 8000
    with socketserver.TCPServer(("", PORT), TestHandler) as httpd:
        print(f"Server running on port {PORT}")
        httpd.serve_forever()
