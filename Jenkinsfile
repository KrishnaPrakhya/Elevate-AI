pipeline {
    agent any

    environment {
        // AWS ECR Configuration
        AWS_ACCOUNT_ID = '123456789012' // Replace with actual AWS Account ID in Jenkins
        AWS_DEFAULT_REGION = 'us-east-1'
        ECR_REGISTRY = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"
        
        // Image names
        FRONTEND_IMAGE = 'elevate-ai-frontend'
        USER_SERVICE_IMAGE = 'elevate-ai-user-service'
        DOCUMENT_SERVICE_IMAGE = 'elevate-ai-document-service'
        CHAT_ORCHESTRATOR_IMAGE = 'elevate-ai-chat-orchestrator'
        AGENT_WORKER_IMAGE = 'elevate-ai-agent-worker'
        
        // Deployment Target
        EC2_IP = '54.210.88.92' // Replace with actual EC2 IP
        EC2_USER = 'ubuntu'
        DEPLOY_PATH = '/home/ubuntu/elevate-ai'
        
        // Credentials IDs in Jenkins
        AWS_CREDENTIALS_ID = 'aws-ecr-credentials'
        SSH_CREDENTIALS_ID = 'aws-ec2-ssh-key'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Security Scan & Lint') {
            parallel {
                stage('Lint Frontend') {
                    steps {
                        dir('.') {
                            sh 'npm install --only=dev'
                            sh 'npm run lint || true' // Lint frontend, allow failure check in output
                        }
                    }
                }
                stage('Lint Microservices') {
                    steps {
                        dir('server/microservices') {
                            sh 'pip install flake8 || true'
                            sh 'flake8 . || true' // Lint python services
                        }
                    }
                }
            }
        }

        stage('Docker Build') {
            steps {
                script {
                    echo "Building Docker Images for ElevateAI..."
                    
                    // Frontend App
                    sh "docker build -f Dockerfile.prod -t ${FRONTEND_IMAGE}:${BUILD_NUMBER} -t ${FRONTEND_IMAGE}:latest ."
                    
                    // Microservices
                    sh "docker build -t ${USER_SERVICE_IMAGE}:${BUILD_NUMBER} -t ${USER_SERVICE_IMAGE}:latest ./server/microservices/services/user-service"
                    sh "docker build -t ${DOCUMENT_SERVICE_IMAGE}:${BUILD_NUMBER} -t ${DOCUMENT_SERVICE_IMAGE}:latest ./server/microservices/services/document-service"
                    sh "docker build -t ${CHAT_ORCHESTRATOR_IMAGE}:${BUILD_NUMBER} -t ${CHAT_ORCHESTRATOR_IMAGE}:latest ./server/microservices/services/chat-orchestrator"
                    sh "docker build -t ${AGENT_WORKER_IMAGE}:${BUILD_NUMBER} -t ${AGENT_WORKER_IMAGE}:latest ./server/microservices/services/agent-worker"
                }
            }
        }

        stage('Push to AWS ECR') {
            steps {
                script {
                    // Login to AWS ECR using AWS credentials configured in Jenkins
                    withCredentials([[
                        $class: 'AmazonWebServicesCredentialsBinding',
                        credentialsId: "${AWS_CREDENTIALS_ID}"
                    ]]) {
                        sh "aws ecr get-login-password --region ${AWS_DEFAULT_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}"
                    }
                    
                    // Tag images for remote registry
                    sh "docker tag ${FRONTEND_IMAGE}:latest ${ECR_REGISTRY}/${FRONTEND_IMAGE}:${BUILD_NUMBER}"
                    sh "docker tag ${FRONTEND_IMAGE}:latest ${ECR_REGISTRY}/${FRONTEND_IMAGE}:latest"
                    
                    sh "docker tag ${USER_SERVICE_IMAGE}:latest ${ECR_REGISTRY}/${USER_SERVICE_IMAGE}:${BUILD_NUMBER}"
                    sh "docker tag ${USER_SERVICE_IMAGE}:latest ${ECR_REGISTRY}/${USER_SERVICE_IMAGE}:latest"
                    
                    sh "docker tag ${DOCUMENT_SERVICE_IMAGE}:latest ${ECR_REGISTRY}/${DOCUMENT_SERVICE_IMAGE}:${BUILD_NUMBER}"
                    sh "docker tag ${DOCUMENT_SERVICE_IMAGE}:latest ${ECR_REGISTRY}/${DOCUMENT_SERVICE_IMAGE}:latest"
                    
                    sh "docker tag ${CHAT_ORCHESTRATOR_IMAGE}:latest ${ECR_REGISTRY}/${CHAT_ORCHESTRATOR_IMAGE}:${BUILD_NUMBER}"
                    sh "docker tag ${CHAT_ORCHESTRATOR_IMAGE}:latest ${ECR_REGISTRY}/${CHAT_ORCHESTRATOR_IMAGE}:latest"
                    
                    sh "docker tag ${AGENT_WORKER_IMAGE}:latest ${ECR_REGISTRY}/${AGENT_WORKER_IMAGE}:${BUILD_NUMBER}"
                    sh "docker tag ${AGENT_WORKER_IMAGE}:latest ${ECR_REGISTRY}/${AGENT_WORKER_IMAGE}:latest"
                    
                    // Push tagged images
                    sh "docker push ${ECR_REGISTRY}/${FRONTEND_IMAGE}:${BUILD_NUMBER}"
                    sh "docker push ${ECR_REGISTRY}/${FRONTEND_IMAGE}:latest"
                    
                    sh "docker push ${ECR_REGISTRY}/${USER_SERVICE_IMAGE}:${BUILD_NUMBER}"
                    sh "docker push ${ECR_REGISTRY}/${USER_SERVICE_IMAGE}:latest"
                    
                    sh "docker push ${ECR_REGISTRY}/${DOCUMENT_SERVICE_IMAGE}:${BUILD_NUMBER}"
                    sh "docker push ${ECR_REGISTRY}/${DOCUMENT_SERVICE_IMAGE}:latest"
                    
                    sh "docker push ${ECR_REGISTRY}/${CHAT_ORCHESTRATOR_IMAGE}:${BUILD_NUMBER}"
                    sh "docker push ${ECR_REGISTRY}/${CHAT_ORCHESTRATOR_IMAGE}:latest"
                    
                    sh "docker push ${ECR_REGISTRY}/${AGENT_WORKER_IMAGE}:${BUILD_NUMBER}"
                    sh "docker push ${ECR_REGISTRY}/${AGENT_WORKER_IMAGE}:latest"
                }
            }
        }

        stage('Deploy to AWS EC2') {
            steps {
                sshagent(["${SSH_CREDENTIALS_ID}"]) {
                    script {
                        echo "Copying deployment configurations to AWS EC2..."
                        sh "ssh -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_IP} 'mkdir -p ${DEPLOY_PATH}'"
                        
                        // Copy docker-compose and environments to EC2
                        sh "scp -o StrictHostKeyChecking=no server/microservices/docker-compose.yml ${EC2_USER}@${EC2_IP}:${DEPLOY_PATH}/docker-compose.yml"
                        
                        // Deploy command on EC2
                        sh """
                            ssh -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_IP} '
                                cd ${DEPLOY_PATH}
                                
                                # Authenticate EC2 Docker client to ECR
                                aws ecr get-login-password --region ${AWS_DEFAULT_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}
                                
                                # Pull production ready images
                                docker-compose pull
                                
                                # Restart containers with updated images
                                docker-compose up -d --remove-orphans
                                
                                # Cleanup dangling images to preserve disk space
                                docker image prune -f
                            '
                        """
                    }
                }
            }
        }
    }

    post {
        always {
            // Clean up workspace on build agent
            cleanWs()
        }
        success {
            echo "Pipeline Completed Successfully! Deployment Active."
        }
        failure {
            echo "Pipeline Failed. Please inspect logs for execution errors."
        }
    }
}
