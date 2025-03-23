from flask import Flask
from flask_cors import CORS
from routes.wf_to_s3 import wf_s3_bp
from routes.process import process_bp
from routes.process_step import process_step_bp
from routes.chat import chat_bp
from routes.prompt_dig import dig_bp
from routes.pc_evidence import pcev_bp
from routes.scrape import scrape_bp

app = Flask(__name__)
CORS(app)

# Register blueprints
app.register_blueprint(process_bp, url_prefix='/api')
app.register_blueprint(process_step_bp, url_prefix='/api')
app.register_blueprint(chat_bp, url_prefix='/api')
app.register_blueprint(dig_bp, url_prefix='/api')
app.register_blueprint(wf_s3_bp, url_prefix='/api') 
app.register_blueprint(pcev_bp, url_prefix='/api') 
app.register_blueprint(scrape_bp, url_prefix='/api') 


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
