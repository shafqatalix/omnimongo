/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-require-imports */




export const InfoMessage = ({ message }: { message: string }) => {
    return <div className="info-message" style={{ marginBottom: '25px', background: '#eff6ff', padding: '16px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#1e40af', fontWeight: '500' }}>
            ℹ️ {message}
        </p>
    </div>

}


