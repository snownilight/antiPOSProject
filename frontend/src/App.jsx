import { Container, Navbar, Nav, Card, Button, Row, Col } from 'react-bootstrap';
import { useState } from 'react';

function App() {
  const [loading, setLoading] = useState(false);

  const testApi = () => {
    setLoading(true);
    fetch('/api/v1/hello')
      .then(res => res.json())
      .then(data => {
        alert(JSON.stringify(data, null, 2));
      })
      .catch(err => alert("Error: " + err))
      .finally(() => setLoading(false));
  };

  const testErrorApi = () => {
    setLoading(true);
    fetch('/api/v1/hello/error-test')
      .then(res => res.json())
      .then(data => {
        alert(JSON.stringify(data, null, 2));
      })
      .catch(err => alert("Error: " + err))
      .finally(() => setLoading(false));
  };

  return (
    <div className="bg-dark text-light min-vh-100 d-flex flex-column">
      <Navbar bg="primary" variant="dark" expand="lg" className="shadow-sm">
        <Container>
          <Navbar.Brand href="#home" className="fw-bold tracking-wide">
            🚀 AntiGravity POS
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="ms-auto">
              <Nav.Link href="#home">儀表板</Nav.Link>
              <Nav.Link href="#orders">訂單管理</Nav.Link>
              <Nav.Link href="#settings">設定</Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container className="flex-grow-1 d-flex align-items-center justify-content-center py-5">
        <Row className="w-100 justify-content-center">
          <Col md={8} lg={6}>
            <Card className="bg-dark border-secondary shadow-lg rounded-4 overflow-hidden glow-effect">
              <div className="card-header bg-gradient-primary border-0 p-4 text-center">
                <h3 className="mb-0 fw-bold">系統狀態</h3>
              </div>
              <Card.Body className="p-5 text-center">
                <Card.Title className="display-6 fw-bold mb-4 text-primary">
                  Welcome Back!
                </Card.Title>
                <Card.Text className="text-secondary mb-5 fs-5">
                  前後端分離架構已成功建立。<br/>
                  點擊下方按鈕測試後端 Spring Boot API 連線。
                </Card.Text>
                <div className="d-flex gap-3 justify-content-center">
                  <Button 
                    variant="primary" 
                    size="lg" 
                    className="rounded-pill px-4 py-3 fw-bold shadow hover-scale"
                    onClick={testApi}
                    disabled={loading}
                  >
                    {loading ? '連線中...' : '測試正常 API'}
                  </Button>
                  <Button 
                    variant="outline-danger" 
                    size="lg" 
                    className="rounded-pill px-4 py-3 fw-bold shadow hover-scale"
                    onClick={testErrorApi}
                    disabled={loading}
                  >
                    {loading ? '連線中...' : '測試錯誤攔截'}
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default App;
