pipeline {
    agent any

    environment {
        DOCKERHUB_CREDENTIALS = credentials('dockerhubtoken')
        IMAGE_NAME  = "bharatraj07/emc-capstone-project"
        IMAGE_TAG   = "${env.BUILD_NUMBER}"
        CONTAINER   = "emc-capstone-project"
        APP_PORT    = "3000"
        SONAR_HOST  = "http://3.15.181.23:9000"
    }

    options {

        timeout(time: 20, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQubeServer') {
                    sh "sonar-scanner -Dsonar.host.url=${SONAR_HOST}"
                }
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Build Docker image') {
            steps {
                sh "docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -t ${IMAGE_NAME}:latest ."
            }
        }

        stage('Push to Docker Hub') {
            steps {

                sh """
                    echo "${DOCKERHUB_CREDENTIALS_PSW}" | docker login -u "${DOCKERHUB_CREDENTIALS_USR}" --password-stdin
                    docker push ${IMAGE_NAME}:${IMAGE_TAG}
                    docker push ${IMAGE_NAME}:latest
                """
            }
        }

        stage('Deploy') {
            steps {
                sh """
                    docker pull ${IMAGE_NAME}:latest
                    docker stop ${CONTAINER} || true
                    docker rm ${CONTAINER} || true
                    docker run -d \
                      --name ${CONTAINER} \
                      --restart unless-stopped \
                      -p ${APP_PORT}:3000 \
                      -v emc-capstone-project:/app/data \
                      ${IMAGE_NAME}:latest
                """
            }
        }

        stage('Verify deployment') {
            steps {
                sh """
                    sleep 5
                    curl -f http://13.59.139.36:${APP_PORT}/health
                """
            }
        }
    }

    post {
        always {
            sh 'docker image prune -f'
        }
        failure {
            echo "Pipeline failed - check the stage above for details."
        }
    }
}
