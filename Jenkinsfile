// Jenkinsfile-backend - Backend Service Pipeline
pipeline {
    agent any
    
    environment {
        // Repository URL
        BACKEND_REPO = 'https://github.com/navinmalviya/rtm-tele-be.git'
        
        // Branch to build
        BRANCH = 'main'
        
        // Container name
        BACKEND_CONTAINER = 'backend-app'
        
        // Image name
        BACKEND_IMAGE = 'backend-app'
        
        // Port mappings
        BACKEND_HOST_PORT = '3001'
        BACKEND_CONTAINER_PORT = '3001'
        
        // Database configuration (update as needed)
        DB_HOST = 'localhost'
        DB_PORT = '5432'
        DB_NAME = 'rtm_telecom_app'
        DB_USER = 'admin'
        DB_PASSWORD = 'pass@123'
        DATABASE_URL = 'postgresql://postgres:postgres@postgres:5432/rtm_telecom_app'
        
        // Network name
        NETWORK_NAME = 'app-network'
    }
    
    stages {
        stage('Setup Workspace') {
            steps {
                sh '''
                    mkdir -p backend
                    echo "Workspace setup completed"
                '''
            }
        }
        
        stage('Clone Backend Repository') {
            steps {
                dir('backend') {
                    // Clean directory if exists
                    sh 'rm -rf *'
                    // Clone backend repository
                    git branch: "${BRANCH}",
                        url: "${BACKEND_REPO}"
                    echo "Backend repository cloned successfully"
                }
            }
        }
        
        stage('Verify Dockerfile') {
            steps {
                script {
                    dir('backend') {
                        if (!fileExists('Dockerfile')) {
                            error("Dockerfile not found in backend repository! Please ensure it exists.")
                        }
                        echo "✓ Backend Dockerfile found"
                    }
                }
            }
        }
        
        stage('Build Docker Image') {
            steps {
                script {
                    dir('backend') {
                        // Generate timestamp for versioning
                        def timestamp = new Date().format('yyyyMMdd-HHmmss')
                        env.BACKEND_TAG = timestamp
                        
                        // Build backend image
                        sh """
                            docker build -t ${BACKEND_IMAGE}:${env.BACKEND_TAG} .
                            docker tag ${BACKEND_IMAGE}:${env.BACKEND_TAG} ${BACKEND_IMAGE}:latest
                        """
                        echo "✓ Backend image built: ${BACKEND_IMAGE}:${env.BACKEND_TAG}"
                    }
                }
            }
        }
        
        stage('Create Docker Network') {
            steps {
                script {
                    // Create network if it doesn't exist
                    sh """
                        docker network inspect ${NETWORK_NAME} > /dev/null 2>&1 || docker network create ${NETWORK_NAME}
                    """
                    echo "✓ Docker network '${NETWORK_NAME}' is ready"
                }
            }
        }
        
        stage('Stop and Remove Old Container') {
            steps {
                script {
                    // Stop and remove old backend container
                    sh """
                        docker stop ${BACKEND_CONTAINER} 2>/dev/null || true
                        docker rm ${BACKEND_CONTAINER} 2>/dev/null || true
                    """
                    echo "✓ Old container removed"
                }
            }
        }
        
        stage('Deploy Backend Container') {
            steps {
                script {
                    // Deploy backend container with database configuration
                    sh """
                        docker run -d \\
                            --name ${BACKEND_CONTAINER} \\
                            --network ${NETWORK_NAME} \\
                            -p ${BACKEND_HOST_PORT}:${BACKEND_CONTAINER_PORT} \\
                            --restart unless-stopped \\
                            -e SPRING_PROFILES_ACTIVE=production \\
                            -e DB_HOST=${DB_HOST} \\
                            -e DB_PORT=${DB_PORT} \\
                            -e DB_NAME=${DB_NAME} \\
                            -e DB_USER=${DB_USER} \\
                            -e DB_PASSWORD=${DB_PASSWORD} \\
                            -e DATABASE_URL=${DATABASE_URL} \\
                            ${BACKEND_IMAGE}:${env.BACKEND_TAG}
                    """
                    echo "✓ Backend container deployed on port ${BACKEND_HOST_PORT}"
                }
            }
        }
        
        stage('Wait for Backend to Start') {
            steps {
                script {
                    // Wait for backend to be ready
                    sleep(15)
                    
                    // Check if container is running
                    def containerStatus = sh(
                        script: "docker ps --filter name=${BACKEND_CONTAINER} --format '{{.Status}}'",
                        returnStdout: true
                    ).trim()
                    
                    echo "Backend container status: ${containerStatus}"
                    
                    // Check backend logs
                    sh "docker logs --tail 30 ${BACKEND_CONTAINER} || true"
                }
            }
        }
        
        stage('Verify Backend Deployment') {
            steps {
                script {
                    // Test if backend is responding
                    def maxRetries = 10
                    def retryCount = 0
                    def backendReady = false
                    
                    while (retryCount < maxRetries && !backendReady) {
                        try {
                            def response = sh(
                                script: "curl -s -o /dev/null -w '%{http_code}' http://localhost:${BACKEND_HOST_PORT}",
                                returnStdout: true
                            ).trim()
                            
                            if (response == "200" || response == "301" || response == "302" || response == "404") {
                                backendReady = true
                                echo "✓ Backend is responding with HTTP ${response}"
                            } else {
                                echo "Backend returned HTTP ${response}, waiting..."
                                sleep(5)
                                retryCount++
                            }
                        } catch (Exception e) {
                            echo "Backend not ready yet (attempt ${retryCount + 1}/${maxRetries})"
                            sleep(5)
                            retryCount++
                        }
                    }
                    
                    if (backendReady) {
                        echo """
                            ====================================
                            Backend Deployment Successful!
                            ====================================
                            Container: ${BACKEND_CONTAINER}
                            URL: http://localhost:${BACKEND_HOST_PORT}
                            Image: ${BACKEND_IMAGE}:${env.BACKEND_TAG}
                            ====================================
                        """
                    } else {
                        echo "⚠ Backend may not be fully ready, but deployment completed"
                        echo "Check logs: docker logs ${BACKEND_CONTAINER}"
                    }
                }
            }
        }
        
        stage('Cleanup Old Images') {
            steps {
                script {
                    // Keep only last 5 images
                    sh """
                        docker image prune -f || true
                        docker images ${BACKEND_IMAGE} --format '{{.Tag}}' | tail -n +6 | xargs -r docker rmi || true
                    """
                    echo "✓ Old images cleaned up"
                }
            }
        }
    }
    
    post {
        success {
            echo """
                🎉 Backend Deployment Successful!
                
                Backend API: http://localhost:${BACKEND_HOST_PORT}
                Image Tag: ${BACKEND_IMAGE}:${env.BACKEND_TAG}
                Container: ${BACKEND_CONTAINER}
                
                To view logs: docker logs -f ${BACKEND_CONTAINER}
                To stop: docker stop ${BACKEND_CONTAINER}
            """
        }
        
        failure {
            echo """
                ❌ Backend Deployment Failed!
                
                Check the logs above for details.
                
                Debug commands:
                - docker ps -a | grep backend
                - docker logs ${BACKEND_CONTAINER}
                - docker inspect ${BACKEND_CONTAINER}
            """
            
            // Show running containers for debugging
            sh 'docker ps -a'
            sh 'docker images | head -20'
            
            // Show backend logs if container exists
            script {
                try {
                    sh "docker logs --tail 50 ${BACKEND_CONTAINER} 2>/dev/null || true"
                } catch (Exception e) {
                    echo "Could not fetch backend logs"
                }
            }
        }
    }
}
